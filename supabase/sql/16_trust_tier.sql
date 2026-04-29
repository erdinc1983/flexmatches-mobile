-- ============================================================
-- FlexMatches — Trust tier (visible reliability badge)
-- ============================================================
-- Tier is computed from existing data:
--   • sessions_completed  (mutual confirmations via confirm_session)
--   • reliability_score   (0–100, derived from no-show rate)
--   • reports_received    (cached counter on users; trigger keeps it
--                          in sync with the reports table)
--
-- Tiers (positive-signal only — no negative scarlet letter):
--   new       → default state, no completed sessions
--   active    → 3+ sessions
--   trusted   → 10+ sessions, reliability ≥ 80, ≤ 1 report
--   vouched   → 20+ sessions, reliability ≥ 90, 0 reports
--
-- Threshold philosophy: forgiving for established users (one stale
-- report shouldn't kill a Trusted user's standing), strict at the
-- top (Vouched signals "people would say good things about this
-- person if asked"). Easy to tune later when we have report data.
-- ============================================================

-- ── 1. Cached counter on users ───────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS reports_received integer NOT NULL DEFAULT 0;

-- Backfill from existing reports (idempotent: recomputes on every run).
UPDATE public.users u
SET reports_received = COALESCE(r.cnt, 0)
FROM (
  SELECT reported_id, COUNT(*) AS cnt
  FROM public.reports
  GROUP BY reported_id
) r
WHERE u.id = r.reported_id;

-- Anyone whose count is stale gets reset to the actual value.
UPDATE public.users
SET reports_received = 0
WHERE reports_received > 0
  AND id NOT IN (SELECT DISTINCT reported_id FROM public.reports WHERE reported_id IS NOT NULL);

-- ── 2. Trigger to keep counter in sync ───────────────────────
CREATE OR REPLACE FUNCTION public.adjust_reports_received()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.users
    SET reports_received = reports_received + 1
    WHERE id = NEW.reported_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.users
    SET reports_received = GREATEST(reports_received - 1, 0)
    WHERE id = OLD.reported_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_adjust_reports_received_ins ON public.reports;
CREATE TRIGGER trg_adjust_reports_received_ins
  AFTER INSERT ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.adjust_reports_received();

DROP TRIGGER IF EXISTS trg_adjust_reports_received_del ON public.reports;
CREATE TRIGGER trg_adjust_reports_received_del
  AFTER DELETE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.adjust_reports_received();

-- ── 3. Pure tier computation function ────────────────────────
-- Pure: same inputs → same output, no side effects, IMMUTABLE.
-- Inlined into queries by the planner — zero runtime cost.
CREATE OR REPLACE FUNCTION public.compute_trust_tier(
  p_sessions_completed integer,
  p_reliability_score  integer,
  p_reports_received   integer
)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_sessions_completed >= 20
     AND p_reliability_score >= 90
     AND p_reports_received = 0 THEN
    RETURN 'vouched';
  ELSIF p_sessions_completed >= 10
        AND p_reliability_score >= 80
        AND p_reports_received <= 1 THEN
    RETURN 'trusted';
  ELSIF p_sessions_completed >= 3 THEN
    RETURN 'active';
  ELSE
    RETURN 'new';
  END IF;
END;
$$;

-- Helper available to authenticated callers in case the client
-- wants to recompute or display tier for ad-hoc records.
GRANT EXECUTE ON FUNCTION public.compute_trust_tier(integer, integer, integer) TO authenticated;

-- ── 3b. Generated column on users so clients can SELECT trust_tier directly ──
-- This is the cleanest way to expose tier in regular table queries without
-- leaking reports_received. The generated column auto-recomputes whenever
-- sessions_completed, reliability_score, or reports_received change (which
-- happens via confirm_session RPC and the reports trigger above).
--
-- We inline the logic here rather than calling compute_trust_tier() so the
-- generation expression stays simple and IMMUTABLE without function-call
-- overhead. The two definitions must stay in sync.
ALTER TABLE public.users
  DROP COLUMN IF EXISTS trust_tier;

ALTER TABLE public.users
  ADD COLUMN trust_tier text
  GENERATED ALWAYS AS (
    CASE
      WHEN sessions_completed >= 20
           AND reliability_score >= 90
           AND reports_received = 0 THEN 'vouched'
      WHEN sessions_completed >= 10
           AND reliability_score >= 80
           AND reports_received <= 1 THEN 'trusted'
      WHEN sessions_completed >= 3 THEN 'active'
      ELSE 'new'
    END
  ) STORED;

-- ── 4. Thread tier into get_nearby_users RPC ─────────────────
-- Same body as 15_hide_from_male.sql but adds trust_tier to the
-- returned row. Only the RETURNS TABLE shape and the inner SELECT
-- changed — everything else (gender filter, fuzz, etc.) preserved.
-- Postgres won't let CREATE OR REPLACE change the return shape, so
-- we drop first. Brief window where the function doesn't exist; the
-- next two clients that call it (probably none, this is sub-millisecond)
-- get a "function not found" — acceptable for a single migration.
DROP FUNCTION IF EXISTS public.get_nearby_users(
  double precision, double precision, double precision, integer, uuid[], integer, uuid
);

CREATE OR REPLACE FUNCTION public.get_nearby_users(
  p_caller_lat  double precision DEFAULT NULL,
  p_caller_lng  double precision DEFAULT NULL,
  p_radius_km   double precision DEFAULT NULL,
  p_limit       integer          DEFAULT 50,
  p_exclude_ids uuid[]           DEFAULT ARRAY[]::uuid[],
  p_offset      integer          DEFAULT 0,
  p_only_id     uuid             DEFAULT NULL
)
RETURNS TABLE (
  id                  uuid,
  username            text,
  full_name           text,
  avatar_url          text,
  bio                 text,
  city                text,
  fitness_level       text,
  age                 integer,
  gender              text,
  sports              text[],
  current_streak      integer,
  last_active         timestamptz,
  is_at_gym           boolean,
  availability        jsonb,
  training_intent     text,
  sessions_completed  integer,
  reliability_score   integer,
  phone_verified      boolean,
  trust_tier          text,
  distance_km         double precision,
  marker_lat          double precision,
  marker_lng          double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_caller_gender text;
BEGIN
  SELECT u.gender::text INTO v_caller_gender
  FROM public.users u
  WHERE u.id = auth.uid();

  RETURN QUERY
  WITH candidates AS (
    SELECT
      u.id,
      u.username,
      u.full_name,
      u.avatar_url,
      u.bio,
      u.city,
      u.fitness_level::text AS fitness_level,
      u.age,
      u.gender::text AS gender,
      u.sports,
      u.current_streak,
      u.last_active,
      u.is_at_gym,
      u.availability,
      u.training_intent,
      u.sessions_completed,
      u.reliability_score,
      u.phone_verified,
      public.compute_trust_tier(
        u.sessions_completed,
        u.reliability_score,
        u.reports_received
      ) AS trust_tier,
      u.lat AS _lat,
      u.lng AS _lng,
      CASE
        WHEN p_caller_lat IS NULL OR p_caller_lng IS NULL OR u.lat IS NULL OR u.lng IS NULL
          THEN NULL
        ELSE (2 * 6371 * asin(sqrt(
          pow(sin(radians(u.lat - p_caller_lat) / 2), 2) +
          cos(radians(p_caller_lat)) * cos(radians(u.lat)) *
          pow(sin(radians(u.lng - p_caller_lng) / 2), 2)
        )))::double precision
      END AS distance_km
    FROM public.users u
    WHERE u.id IS DISTINCT FROM auth.uid()
      AND u.banned_at IS NULL
      AND COALESCE((u.privacy_settings->>'hide_profile')::boolean, false) = false
      AND (
        v_caller_gender IS DISTINCT FROM 'male'
        OR COALESCE((u.privacy_settings->>'hide_from_male')::boolean, false) = false
      )
      AND NOT (u.id = ANY(p_exclude_ids))
      AND (p_only_id IS NULL OR u.id = p_only_id)
      AND (p_radius_km IS NULL OR (u.lat IS NOT NULL AND u.lng IS NOT NULL))
  )
  SELECT
    c.id, c.username, c.full_name, c.avatar_url, c.bio, c.city,
    c.fitness_level, c.age, c.gender, c.sports, c.current_streak,
    c.last_active, c.is_at_gym, c.availability, c.training_intent,
    c.sessions_completed, c.reliability_score, c.phone_verified,
    c.trust_tier,
    c.distance_km,
    round(c._lat::numeric, 2)::double precision AS marker_lat,
    round(c._lng::numeric, 2)::double precision AS marker_lng
  FROM candidates c
  WHERE p_radius_km IS NULL OR c.distance_km IS NULL OR c.distance_km <= p_radius_km
  ORDER BY
    (c.distance_km IS NULL),
    c.distance_km NULLS LAST,
    c.last_active DESC NULLS LAST,
    c.id
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_nearby_users(
  double precision, double precision, double precision, integer, uuid[], integer, uuid
) TO authenticated;

-- ── Verify ────────────────────────────────────────────────────
-- SELECT username, sessions_completed, reliability_score, reports_received,
--        public.compute_trust_tier(sessions_completed, reliability_score, reports_received) AS tier
-- FROM users ORDER BY sessions_completed DESC LIMIT 10;
