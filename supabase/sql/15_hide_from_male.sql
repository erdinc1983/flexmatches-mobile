-- ============================================================
-- FlexMatches — hide_from_male privacy filter
-- ============================================================
-- Female users (and others who feel safer in a women-only search)
-- can flip privacy_settings.hide_from_male = true to hide their
-- profile from any user whose gender = "male".
--
-- Enforced where it matters most: get_nearby_users (the RPC that
-- powers Discover map, Discover list, Home best matches, and
-- single-user lookups). The filter has to live server-side because
-- the client could otherwise be patched/bypassed.
--
-- Logic:
--   • If caller's gender is "male" → exclude any candidate whose
--     privacy_settings.hide_from_male = true
--   • If caller's gender is anything else (female, non-binary, null,
--     unset) → no exclusion; everyone shows normally
-- ============================================================

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
  -- Look up the caller's gender once. NULL/non-male callers get the full
  -- candidate set; male callers get filtered to exclude hide_from_male users.
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
      -- Hide-from-male safety filter. Only kicks in when the caller is male.
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
-- Set a test user's hide_from_male to true:
--   UPDATE users SET privacy_settings =
--     jsonb_set(COALESCE(privacy_settings, '{}'::jsonb), '{hide_from_male}', 'true')
--   WHERE id = '<uuid>';
-- Then call get_nearby_users from a male caller — that user should NOT appear.
-- Call again from a female caller — that user SHOULD appear.
