-- ============================================================
-- FlexMatches — Eagle 0 Supabase Migrations
-- Run this in Supabase SQL Editor BEFORE starting Eagle 0
-- ============================================================

-- 1. STREAK LOGIC RPC (FM-401, FM-402)
-- Atomic streak update: checks consecutive days, prevents spam
-- Returns: { streak: number, already_checked_in: boolean }
CREATE OR REPLACE FUNCTION public.log_checkin(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_last_date   date;
  v_today       date := current_date;
  v_streak      int;
  v_already     boolean := false;
BEGIN
  -- Get current streak and last check-in
  SELECT 
    last_checkin_date::date,
    current_streak
  INTO v_last_date, v_streak
  FROM public.users
  WHERE id = p_user_id;

  -- Already checked in today? Return early
  IF v_last_date = v_today THEN
    RETURN jsonb_build_object(
      'streak', v_streak,
      'already_checked_in', true
    );
  END IF;

  -- Consecutive day? Increment. Otherwise reset.
  IF v_last_date = v_today - 1 THEN
    v_streak := v_streak + 1;
  ELSE
    v_streak := 1;
  END IF;

  -- Update user
  UPDATE public.users
  SET 
    current_streak = v_streak,
    last_checkin_date = v_today::text
  WHERE id = p_user_id;

  -- Log the workout
  INSERT INTO public.workouts (user_id, exercise_type, duration_min, logged_at)
  VALUES (p_user_id, 'Check-in', 0, now());

  RETURN jsonb_build_object(
    'streak', v_streak,
    'already_checked_in', false
  );
END;
$$;

-- Grant access to authenticated users
GRANT EXECUTE ON FUNCTION public.log_checkin(uuid) TO authenticated;


-- 2. STREAK UPDATE RPC FOR FULL WORKOUT LOG (FM-401)
-- Called by logWorkout() after inserting the workout row.
-- Client passes local date string (YYYY-MM-DD) to avoid UTC midnight issues.
-- Returns: { streak: number, already_checked_in: boolean }
CREATE OR REPLACE FUNCTION public.update_streak_for_workout(
  p_user_id   uuid,
  p_local_date text   -- client local date e.g. '2026-04-02'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_last_date text;
  v_streak    int;
BEGIN
  SELECT last_checkin_date, current_streak
  INTO v_last_date, v_streak
  FROM public.users
  WHERE id = p_user_id;

  -- Already logged today — do not increment
  IF v_last_date = p_local_date THEN
    RETURN jsonb_build_object('streak', v_streak, 'already_checked_in', true);
  END IF;

  -- Consecutive day → increment; gap → reset
  IF v_last_date IS NOT NULL
     AND (p_local_date::date - v_last_date::date) = 1 THEN
    v_streak := v_streak + 1;
  ELSE
    v_streak := 1;
  END IF;

  UPDATE public.users
  SET current_streak    = v_streak,
      last_checkin_date = p_local_date
  WHERE id = p_user_id;

  RETURN jsonb_build_object('streak', v_streak, 'already_checked_in', false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_streak_for_workout(uuid, text) TO authenticated;


-- 3. ADD 'unmatched' as valid match status (FM-201)
-- This comment documents the new status value.
-- No schema change needed if status is a text column.
-- We just start using 'unmatched' in addition to pending/accepted/declined.
-- Verify: SELECT DISTINCT status FROM matches;


-- 3. VERIFY RLS POLICIES EXIST
-- Run these checks and note any missing policies:
-- SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';
-- Critical tables that MUST have RLS:
--   users, matches, messages, workouts, buddy_sessions, 
--   notifications, communities, community_members,
--   feed_posts, blocks, reports
