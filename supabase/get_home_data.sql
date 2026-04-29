-- ============================================================
-- get_home_data(p_user_id uuid)
-- Returns everything the Home screen needs in a single round-trip,
-- replacing the ~13 sequential/parallel Supabase client queries.
--
-- Returns a single JSON object with:
--   match_count         int
--   workout_count_month int
--   pending_requests    jsonb   (max 5)
--   sessions_today      jsonb
--   upcoming_sessions   jsonb   (next 14 days)
--   my_circles          jsonb   (joined, with member counts)
--   accepted_match_ids  jsonb   (for partner map)
--   candidates          jsonb   (max 40, for BestMatches scoring)
--   new_circles         jsonb   (last 7 days, max 20, not joined)
--
-- Deploy:
--   supabase.exe functions deploy  (not needed — this is a DB RPC)
--   Run this SQL in Supabase Dashboard → SQL Editor
-- ============================================================

CREATE OR REPLACE FUNCTION get_home_data(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today          date        := CURRENT_DATE;
  v_month_ago      timestamptz := now() - interval '30 days';
  v_seven_days_ago timestamptz := now() - interval '7 days';
  v_fourteen_days  date        := CURRENT_DATE + interval '14 days';
  v_two_hours_ago  timestamptz := now() - interval '2 hours';

  v_match_count         int;
  v_workout_month       int;
  v_pending_requests    jsonb;
  v_sessions_today      jsonb;
  v_upcoming_sessions   jsonb;
  v_my_circles          jsonb;
  v_accepted_matches    jsonb;
  v_candidates          jsonb;
  v_new_circles         jsonb;
BEGIN

  -- ── 1. Match count (accepted) ─────────────────────────────────────────────
  SELECT COUNT(*)
  INTO v_match_count
  FROM matches
  WHERE status = 'accepted'
    AND (sender_id = p_user_id OR receiver_id = p_user_id);

  -- ── 2. Monthly workout count ──────────────────────────────────────────────
  SELECT COUNT(*)
  INTO v_workout_month
  FROM workouts
  WHERE user_id = p_user_id
    AND logged_at >= v_month_ago;

  -- ── 3. Pending match requests (others → me, max 5) ────────────────────────
  SELECT COALESCE(jsonb_agg(row_to_json(r.*)), '[]'::jsonb)
  INTO v_pending_requests
  FROM (
    SELECT
      m.id,
      m.sender_id,
      u.username,
      u.full_name,
      u.avatar_url,
      u.fitness_level,
      u.city
    FROM matches m
    JOIN users u ON u.id = m.sender_id AND u.banned_at IS NULL
    WHERE m.receiver_id = p_user_id
      AND m.status = 'pending'
    ORDER BY m.created_at DESC
    LIMIT 5
  ) r;

  -- ── 4. Today's sessions (accepted + pending) ──────────────────────────────
  SELECT COALESCE(jsonb_agg(row_to_json(r.*)), '[]'::jsonb)
  INTO v_sessions_today
  FROM (
    SELECT
      bs.id,
      bs.match_id,
      bs.sport,
      bs.session_date,
      bs.session_time,
      bs.location,
      bs.status,
      bs.proposer_id,
      bs.receiver_id,
      COALESCE(u.full_name, u.username) AS partner_name
    FROM buddy_sessions bs
    JOIN users u ON u.id = CASE
      WHEN bs.proposer_id = p_user_id THEN bs.receiver_id
      ELSE bs.proposer_id
    END
    WHERE (bs.proposer_id = p_user_id OR bs.receiver_id = p_user_id)
      AND bs.session_date = v_today
      AND bs.status IN ('accepted', 'pending')
  ) r;

  -- ── 5. Upcoming sessions (today + 14 days) ────────────────────────────────
  SELECT COALESCE(jsonb_agg(row_to_json(r.*) ORDER BY r.session_date), '[]'::jsonb)
  INTO v_upcoming_sessions
  FROM (
    SELECT
      bs.id,
      bs.match_id,
      bs.sport,
      bs.session_date,
      bs.session_time,
      bs.location,
      bs.status,
      bs.proposer_id,
      bs.receiver_id,
      COALESCE(u.full_name, u.username) AS partner_name
    FROM buddy_sessions bs
    JOIN users u ON u.id = CASE
      WHEN bs.proposer_id = p_user_id THEN bs.receiver_id
      ELSE bs.proposer_id
    END
    WHERE (bs.proposer_id = p_user_id OR bs.receiver_id = p_user_id)
      AND bs.session_date >= v_today
      AND bs.session_date <= v_fourteen_days
      AND bs.status IN ('pending', 'accepted')
    ORDER BY bs.session_date ASC
  ) r;

  -- ── 6. My circles (joined) with member counts ─────────────────────────────
  SELECT COALESCE(jsonb_agg(row_to_json(r.*)), '[]'::jsonb)
  INTO v_my_circles
  FROM (
    SELECT
      c.id,
      c.name,
      c.avatar_emoji,
      c.sport,
      c.city,
      c.field,
      c.description,
      c.event_date,
      c.event_time,
      c.creator_id,
      (SELECT COUNT(*) FROM community_members cm2 WHERE cm2.community_id = c.id) AS member_count
    FROM community_members cm
    JOIN communities c ON c.id = cm.community_id
    WHERE cm.user_id = p_user_id
    LIMIT 10
  ) r;

  -- ── 7. Accepted match IDs (for partner map + active partners) ────────────
  SELECT COALESCE(jsonb_agg(row_to_json(r.*)), '[]'::jsonb)
  INTO v_accepted_matches
  FROM (
    SELECT
      m.id AS match_id,
      m.sender_id,
      m.receiver_id,
      CASE WHEN m.sender_id = p_user_id THEN m.receiver_id ELSE m.sender_id END AS partner_id,
      u.username,
      u.full_name,
      u.avatar_url,
      u.is_at_gym,
      u.last_active
    FROM matches m
    JOIN users u ON u.id = CASE
      WHEN m.sender_id = p_user_id THEN m.receiver_id
      ELSE m.sender_id
    END
    WHERE m.status = 'accepted'
      AND (m.sender_id = p_user_id OR m.receiver_id = p_user_id)
      AND u.banned_at IS NULL
  ) r;

  -- ── 8. Candidate users for BestMatches (max 40, exclude self) ────────────
  SELECT COALESCE(jsonb_agg(row_to_json(r.*)), '[]'::jsonb)
  INTO v_candidates
  FROM (
    SELECT
      u.id,
      u.username,
      u.full_name,
      u.avatar_url,
      u.city,
      u.sports,
      u.fitness_level,
      u.gender,
      u.trust_tier,
      u.availability
    FROM users u
    WHERE u.id <> p_user_id
      AND u.banned_at IS NULL
      -- Exclude already-matched or pending
      AND u.id NOT IN (
        SELECT CASE WHEN sender_id = p_user_id THEN receiver_id ELSE sender_id END
        FROM matches
        WHERE sender_id = p_user_id OR receiver_id = p_user_id
      )
    LIMIT 40
  ) r;

  -- ── 9. New circles (last 7 days, not joined, max 20) ─────────────────────
  SELECT COALESCE(jsonb_agg(row_to_json(r.*)), '[]'::jsonb)
  INTO v_new_circles
  FROM (
    SELECT
      c.id,
      c.name,
      c.avatar_emoji,
      c.sport,
      c.city,
      c.field,
      c.description,
      c.max_members,
      c.event_date,
      c.event_time,
      c.creator_id,
      (SELECT COUNT(*) FROM community_members cm2 WHERE cm2.community_id = c.id) AS member_count
    FROM communities c
    WHERE c.created_at >= v_seven_days_ago
      AND c.id NOT IN (
        SELECT community_id FROM community_members WHERE user_id = p_user_id
      )
    ORDER BY c.created_at DESC
    LIMIT 20
  ) r;

  -- ── Return everything as a single JSON object ─────────────────────────────
  RETURN jsonb_build_object(
    'match_count',         v_match_count,
    'workout_count_month', v_workout_month,
    'pending_requests',    v_pending_requests,
    'sessions_today',      v_sessions_today,
    'upcoming_sessions',   v_upcoming_sessions,
    'my_circles',          v_my_circles,
    'accepted_matches',    v_accepted_matches,
    'candidates',          v_candidates,
    'new_circles',         v_new_circles
  );
END;
$$;

-- Grant access to authenticated users
GRANT EXECUTE ON FUNCTION get_home_data(uuid) TO authenticated;
