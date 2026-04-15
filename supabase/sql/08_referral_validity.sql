-- ============================================================
-- FlexMatches — Referral validity + anti-abuse
-- ============================================================
-- Mara's spec:
--   A referral counts toward rewards only when:
--     1. Invited user signed up with a referral code (row exists)
--     2. Phone verified
--     3. Onboarding complete (full_name set)
--     4. Not the same account as the inviter (no self-referral)
--   If abuse is detected, rewards can be removed.
--
-- Schema:
--   referrals.validated_at timestamptz  — NULL until criteria met
--   Optional per-row notes via validation_note for audit trail.
--
-- Validation is idempotent: calling validate_referral twice is a no-op.
-- ============================================================

ALTER TABLE public.referrals
  ADD COLUMN IF NOT EXISTS validated_at    timestamptz,
  ADD COLUMN IF NOT EXISTS validation_note text;

CREATE INDEX IF NOT EXISTS idx_referrals_referrer_validated
  ON public.referrals (referrer_id, validated_at);

-- Check whether a referral would pass validation, without mutating it.
-- Returns {ok: boolean, reason: text | null}.
CREATE OR REPLACE FUNCTION public.check_referral(
  p_referrer_id       uuid,
  p_referred_user_id  uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref      public.users;
BEGIN
  IF p_referrer_id = p_referred_user_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'self_referral');
  END IF;

  SELECT * INTO v_ref FROM public.users WHERE id = p_referred_user_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'referred_user_not_found');
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

  RETURN jsonb_build_object('ok', true, 'reason', null);
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_referral(uuid, uuid) TO authenticated;

-- Validate (mark validated_at) or no-op if criteria not yet met.
-- Call this after phone verification completes and again on onboarding finish.
CREATE OR REPLACE FUNCTION public.validate_referral(
  p_referred_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref       public.referrals;
  v_check     jsonb;
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
  RETURN jsonb_build_object('ok', true, 'reason', 'just_validated');
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_referral(uuid) TO authenticated;

-- Trigger: attempt validation automatically on relevant users column updates
-- (phone_verified flipped to true, OR full_name populated for the first time).
CREATE OR REPLACE FUNCTION public.try_validate_referral_on_user_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (NEW.phone_verified IS TRUE AND OLD.phone_verified IS DISTINCT FROM NEW.phone_verified)
  OR (NEW.full_name IS NOT NULL AND OLD.full_name IS DISTINCT FROM NEW.full_name) THEN
    PERFORM public.validate_referral(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_try_validate_referral ON public.users;
CREATE TRIGGER trg_try_validate_referral
  AFTER UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.try_validate_referral_on_user_update();

-- ── Verify ───────────────────────────────────────────────────
-- SELECT COUNT(*) FROM referrals WHERE validated_at IS NOT NULL;
