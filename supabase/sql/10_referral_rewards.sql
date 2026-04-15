-- ============================================================
-- FlexMatches — Referral reward grant engine
-- ============================================================
-- James caught the gap: the app advertises 1/3/6 referral milestones
-- but no code actually grants the badge or Pro extension when those
-- thresholds are hit. validate_referral marked rows valid; nothing
-- consumed the count.
--
-- This file:
--   • Adds users.pro_expires_at (paid/referral Pro is time-bounded)
--   • RPC apply_referral_rewards(p_referrer_id) — idempotent. Counts
--     validated referrals, grants whatever the user qualifies for and
--     hasn't already received. Safe to call many times.
--   • Re-runs apply_referral_rewards from validate_referral after a
--     successful validation so rewards land automatically.
--   • Adds users.phone unique constraint (best-effort) so anti-abuse
--     check_referral can rely on phone uniqueness.
--   • Adds users.referral_code unique index so the client's
--     "retry on collision" code actually catches collisions.
-- ============================================================

-- ── Schema additions ────────────────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS pro_expires_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code_unique
  ON public.users (referral_code)
  WHERE referral_code IS NOT NULL;

-- Phone uniqueness: enforce only on non-null phones so users without a
-- phone don't all collide on NULL. Using a unique partial index.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone_unique
  ON public.users (phone)
  WHERE phone IS NOT NULL;

-- Track which milestone tiers have already been granted so the function
-- is idempotent + so we never double-grant a Pro extension.
CREATE TABLE IF NOT EXISTS public.referral_grants (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id     uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  milestone       integer NOT NULL,        -- 1, 3, 6
  badge_key       text,
  pro_months_gtd  integer,
  granted_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (referrer_id, milestone)
);

CREATE INDEX IF NOT EXISTS idx_referral_grants_referrer
  ON public.referral_grants (referrer_id);

-- ── badge helper (uses existing user_badges shape) ──────────
CREATE OR REPLACE FUNCTION public.award_badge_if_missing(
  p_user_id uuid,
  p_key     text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_badges (user_id, badge_key)
  VALUES (p_user_id, p_key)
  ON CONFLICT DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.award_badge_if_missing(uuid, text) TO authenticated;

-- ── extend Pro by N months (additive — never shortens an existing window) ──
CREATE OR REPLACE FUNCTION public.extend_pro_by_months(
  p_user_id uuid,
  p_months  integer,
  p_source  text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_expiry timestamptz;
  v_base           timestamptz;
BEGIN
  SELECT pro_expires_at INTO v_current_expiry FROM public.users WHERE id = p_user_id;
  -- If user already has a Pro window in the future, extend from that;
  -- otherwise start from now. Founding Pro (no expiry) stays primary —
  -- we still update pro_expires_at as a record but is_pro stays true.
  v_base := GREATEST(COALESCE(v_current_expiry, now()), now());

  UPDATE public.users
  SET is_pro         = true,
      pro_source     = COALESCE(pro_source, p_source),
      pro_granted_at = COALESCE(pro_granted_at, now()),
      pro_expires_at = v_base + (p_months || ' months')::interval
  WHERE id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.extend_pro_by_months(uuid, integer, text) TO authenticated;

-- ── core: apply rewards for a referrer (idempotent) ─────────
CREATE OR REPLACE FUNCTION public.apply_referral_rewards(
  p_referrer_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_validated  integer;
  v_granted    text[] := ARRAY[]::text[];
BEGIN
  SELECT COUNT(*) INTO v_validated
  FROM public.referrals
  WHERE referrer_id = p_referrer_id AND validated_at IS NOT NULL;

  -- Tier 1: first valid referral → first_referral badge
  IF v_validated >= 1 AND NOT EXISTS (
    SELECT 1 FROM public.referral_grants
    WHERE referrer_id = p_referrer_id AND milestone = 1
  ) THEN
    PERFORM public.award_badge_if_missing(p_referrer_id, 'first_referral');
    INSERT INTO public.referral_grants (referrer_id, milestone, badge_key)
    VALUES (p_referrer_id, 1, 'first_referral');
    v_granted := array_append(v_granted, 'first_referral_badge');
  END IF;

  -- Tier 2: 3 valid → 3 months Pro
  IF v_validated >= 3 AND NOT EXISTS (
    SELECT 1 FROM public.referral_grants
    WHERE referrer_id = p_referrer_id AND milestone = 3
  ) THEN
    PERFORM public.extend_pro_by_months(p_referrer_id, 3, 'referral_3');
    INSERT INTO public.referral_grants (referrer_id, milestone, pro_months_gtd)
    VALUES (p_referrer_id, 3, 3);
    v_granted := array_append(v_granted, 'pro_3_months');
  END IF;

  -- Tier 3: 6 valid → 6 months Pro
  IF v_validated >= 6 AND NOT EXISTS (
    SELECT 1 FROM public.referral_grants
    WHERE referrer_id = p_referrer_id AND milestone = 6
  ) THEN
    PERFORM public.extend_pro_by_months(p_referrer_id, 6, 'referral_6');
    INSERT INTO public.referral_grants (referrer_id, milestone, pro_months_gtd)
    VALUES (p_referrer_id, 6, 6);
    v_granted := array_append(v_granted, 'pro_6_months');
  END IF;

  RETURN jsonb_build_object(
    'validated_count', v_validated,
    'granted_now',     v_granted
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_referral_rewards(uuid) TO authenticated;

-- ── extend validate_referral to fire reward grant on success ───────
CREATE OR REPLACE FUNCTION public.validate_referral(
  p_referred_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref      public.referrals;
  v_check    jsonb;
  v_rewards  jsonb;
BEGIN
  SELECT * INTO v_ref FROM public.referrals WHERE referred_user_id = p_referred_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no_referral_row');
  END IF;
  IF v_ref.validated_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'already_validated');
  END IF;

  v_check := public.check_referral(v_ref.referrer_id, p_referred_user_id);
  IF (v_check->>'ok')::boolean IS NOT TRUE THEN
    RETURN v_check;
  END IF;

  UPDATE public.referrals
  SET validated_at = now(),
      validation_note = 'auto: phone_verified + onboarding_complete'
  WHERE id = v_ref.id;

  -- Apply any newly-earned milestone rewards. Idempotent — won't re-grant
  -- tiers the referrer already received.
  v_rewards := public.apply_referral_rewards(v_ref.referrer_id);

  RETURN jsonb_build_object(
    'ok', true, 'reason', 'just_validated',
    'rewards', v_rewards
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_referral(uuid) TO authenticated;

-- ── extend check_referral to enforce phone uniqueness ──────────────
CREATE OR REPLACE FUNCTION public.check_referral(
  p_referrer_id      uuid,
  p_referred_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref           public.users;
  v_referrer      public.users;
BEGIN
  IF p_referrer_id = p_referred_user_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'self_referral');
  END IF;

  SELECT * INTO v_ref      FROM public.users WHERE id = p_referred_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'referred_user_not_found');
  END IF;
  SELECT * INTO v_referrer FROM public.users WHERE id = p_referrer_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'referrer_not_found');
  END IF;

  IF v_ref.phone_verified IS NOT TRUE THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'phone_not_verified');
  END IF;

  IF v_ref.full_name IS NULL OR length(trim(v_ref.full_name)) < 2 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'onboarding_incomplete');
  END IF;

  IF v_ref.banned_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'referred_user_banned');
  END IF;

  -- Phone uniqueness vs referrer (catches "I'm both accounts on the same SIM")
  IF v_ref.phone IS NOT NULL AND v_ref.phone = v_referrer.phone THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'same_phone_as_referrer');
  END IF;

  RETURN jsonb_build_object('ok', true, 'reason', null);
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_referral(uuid, uuid) TO authenticated;

-- ── Verify ───────────────────────────────────────────────────
-- SELECT * FROM apply_referral_rewards('<uuid>');
-- SELECT * FROM referral_grants;
