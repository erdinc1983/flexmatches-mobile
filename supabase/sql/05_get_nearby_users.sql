-- ============================================================
-- FlexMatches — get_nearby_users RPC (privacy boundary)
-- ============================================================
-- Single server-side entry point for peer profile data. Used by:
--   • DiscoverMap  — tight radius (15km), requires caller coords, returns
--                    fuzzed marker positions for map render
--   • Discover list/swipe — no radius, caller coords optional, returns
--                           distance_km (null if either side missing coords)
--   • Home suggested-partner — same as discover, single-row lookup via
--                              p_only_id filter
--
-- Guarantees:
--   • NEVER returns raw u.lat / u.lng to the caller
--   • Computes haversine server-side so the client never sees partner coords
--   • Fuzzes marker coords to ~1.1km precision (2 decimal places)
--   • Excludes self, banned users, and users with privacy_settings.hide_profile=true
--   • Excludes caller-supplied exclude_ids (already-matched/pending users)
--
-- When p_radius_km IS NOT NULL (map path), users without coords are
-- excluded — they have no marker position. When p_radius_km IS NULL
-- (list path), coordless users are included with distance_km = NULL
-- so profile discovery still works for users who denied location.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_nearby_users(
  p_caller_lat  double precision DEFAULT NULL,
  p_caller_lng  double precision DEFAULT NULL,
  p_radius_km   double precision DEFAULT NULL,
  p_limit       integer          DEFAULT 50,
  p_exclude_ids uuid[]           DEFAULT ARRAY[]::uuid[],
  p_offset      integer          DEFAULT 0,
  p_only_id     uuid             DEFAULT NULL   -- single-row lookup (home)
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
  distance_km         double precision,
  marker_lat          double precision,
  marker_lng          double precision
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
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
      AND NOT (u.id = ANY(p_exclude_ids))
      AND (p_only_id IS NULL OR u.id = p_only_id)
      -- Map path (p_radius_km set) requires coords; list path allows coordless users
      AND (p_radius_km IS NULL OR (u.lat IS NOT NULL AND u.lng IS NOT NULL))
  )
  SELECT
    c.id, c.username, c.full_name, c.avatar_url, c.bio, c.city,
    c.fitness_level, c.age, c.gender, c.sports, c.current_streak,
    c.last_active, c.is_at_gym, c.availability, c.training_intent,
    c.sessions_completed, c.reliability_score, c.phone_verified,
    c.distance_km,
    -- Fuzz marker coords. NULL propagates for users / callers without coords.
    round(c._lat::numeric, 2)::double precision AS marker_lat,
    round(c._lng::numeric, 2)::double precision AS marker_lng
  FROM candidates c
  WHERE p_radius_km IS NULL OR c.distance_km IS NULL OR c.distance_km <= p_radius_km
  ORDER BY
    (c.distance_km IS NULL),    -- known-distance first
    c.distance_km NULLS LAST,
    c.last_active DESC NULLS LAST,
    c.id                        -- stable tiebreaker for OFFSET pagination
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Drop old 4-arg signature (before adding exclude/offset/only_id params) so
-- clients can't call a stale overload. The new signature above handles all callers.
DROP FUNCTION IF EXISTS public.get_nearby_users(double precision, double precision, double precision, integer);

GRANT EXECUTE ON FUNCTION public.get_nearby_users(
  double precision, double precision, double precision, integer, uuid[], integer, uuid
) TO authenticated;

-- ── Verify ────────────────────────────────────────────────────
-- Map path (requires coords, 15km):
--   SELECT id, username, distance_km, marker_lat, marker_lng
--   FROM get_nearby_users(40.21::double precision, -75.28::double precision, 15);
-- Discover path (no radius, optional caller coords):
--   SELECT id, username, distance_km FROM get_nearby_users(40.21, -75.28, NULL, 50);
-- Single-user lookup (home):
--   SELECT * FROM get_nearby_users(40.21, -75.28, NULL, 1, ARRAY[]::uuid[], 0, 'abc-uuid'::uuid);
