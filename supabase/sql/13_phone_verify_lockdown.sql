-- ============================================================
-- FlexMatches — phone_verified column lockdown + RPC public/internal split
-- ============================================================
-- James caught two trust-boundary issues:
--
-- 1) phone_verified is client-writable. Even with OTP done client-side,
--    a malicious client can skip OTP and POST .update({ phone_verified: true })
--    directly via the Supabase REST API (assuming RLS allows updates to
--    one's own row, which it does today via users_update). Since referral
--    rewards depend on phone_verified, this converts directly to free Pro.
--    Fix: REVOKE UPDATE (phone_verified) on public.users from authenticated.
--    Server-side write happens only in the verify-phone Edge Function via
--    the service role. Same for users.phone (a verified phone number must
--    be set by the same trusted path that proved it).
--
-- 2) apply_referral_rewards(referrer_id) takes a uuid param, granted to
--    authenticated, with an auth.uid() IS NULL → "allow" branch for
--    service-role contexts. That branch also allows anon callers when
--    auth.uid() returns NULL. Cleaner: split into a private internal
--    function (locked) and a public no-arg function that derives the
--    referrer_id from auth.uid() and rejects NULL callers.
-- ============================================================

-- ── 1. Column-level lockdown ──────────────────────────────────
-- Postgres column-level GRANT/REVOKE only takes effect if the table-level
-- UPDATE grant is removed first, then re-issued for the columns we want
-- to allow. Doing this would break every other client write. Instead, we
-- use a trigger that rejects client-side attempts to change phone_verified
-- or phone (i.e. when auth.uid() is non-null and the new values differ).
-- Service role calls have auth.uid() = NULL and pass through.

CREATE OR REPLACE FUNCTION public.guard_phone_verified_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service role / postgres / migrations: auth.uid() is NULL → no guard.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Authenticated client: phone_verified MUST NOT change. The verify-phone
  -- Edge Function runs as service role, so its writes bypass this guard.
  IF NEW.phone_verified IS DISTINCT FROM OLD.phone_verified THEN
    RAISE EXCEPTION 'phone_verified can only be set via the verify-phone Edge Function'
      USING ERRCODE = '42501';  -- insufficient_privilege
  END IF;

  -- Same protection for the phone column itself: if a client could set
  -- phone freely while phone_verified stayed true, they could "rotate"
  -- the verified number to anything. Verified phone is owned by the
  -- server flow that proved it.
  IF OLD.phone_verified IS TRUE
     AND NEW.phone IS DISTINCT FROM OLD.phone THEN
    RAISE EXCEPTION 'phone cannot be changed while verified — re-verify via the verify-phone flow'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_phone_verified ON public.users;
CREATE TRIGGER trg_guard_phone_verified
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.guard_phone_verified_write();

-- ── 2. Public / internal RPC split for referral rewards ──────
-- Internal: takes a uuid, fully locked. Only called by validate_referral
-- or other trusted server processes.
CREATE OR REPLACE FUNCTION public.private_apply_referral_rewards(
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

  IF v_validated >= 1 AND NOT EXISTS (
    SELECT 1 FROM public.referral_grants
    WHERE referrer_id = p_referrer_id AND milestone = 1
  ) THEN
    PERFORM public.award_badge_if_missing(p_referrer_id, 'first_referral');
    INSERT INTO public.referral_grants (referrer_id, milestone, badge_key)
    VALUES (p_referrer_id, 1, 'first_referral');
    v_granted := array_append(v_granted, 'first_referral_badge');
  END IF;

  IF v_validated >= 3 AND NOT EXISTS (
    SELECT 1 FROM public.referral_grants
    WHERE referrer_id = p_referrer_id AND milestone = 3
  ) THEN
    PERFORM public.extend_pro_by_months(p_referrer_id, 3, 'referral_3');
    INSERT INTO public.referral_grants (referrer_id, milestone, pro_months_gtd)
    VALUES (p_referrer_id, 3, 3);
    v_granted := array_append(v_granted, 'pro_3_months');
  END IF;

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

REVOKE EXECUTE ON FUNCTION public.private_apply_referral_rewards(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.private_apply_referral_rewards(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.private_apply_referral_rewards(uuid) FROM public;

-- Public no-arg wrapper. Caller must be authenticated; we derive the
-- referrer_id from auth.uid() and pass to the private function. Anon
-- callers (auth.uid() IS NULL) are explicitly rejected.
CREATE OR REPLACE FUNCTION public.apply_my_referral_rewards()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'authentication required'
      USING ERRCODE = '28000';  -- invalid_authorization_specification
  END IF;
  RETURN public.private_apply_referral_rewards(v_uid);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_my_referral_rewards() FROM anon;
REVOKE EXECUTE ON FUNCTION public.apply_my_referral_rewards() FROM public;
GRANT  EXECUTE ON FUNCTION public.apply_my_referral_rewards() TO authenticated;

-- Update validate_referral to call the new private function.
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
  SET validated_at    = now(),
      validation_note = 'auto: phone_verified + onboarding_complete'
  WHERE id = v_ref.id;

  v_rewards := public.private_apply_referral_rewards(v_ref.referrer_id);

  RETURN jsonb_build_object(
    'ok', true, 'reason', 'just_validated',
    'rewards', v_rewards
  );
END;
$$;

-- Drop the old ambiguous function so no client code can accidentally call it.
DROP FUNCTION IF EXISTS public.apply_referral_rewards(uuid);

-- ── Verify ────────────────────────────────────────────────────
-- As a logged-in user, this should now FAIL (was the bypass):
--   UPDATE users SET phone_verified = true WHERE id = auth.uid();
--   → ERROR: phone_verified can only be set via the verify-phone Edge Function
--
-- This should now succeed (no-arg, takes auth.uid() automatically):
--   SELECT apply_my_referral_rewards();
--
-- This should fail (function dropped):
--   SELECT apply_referral_rewards(auth.uid());
