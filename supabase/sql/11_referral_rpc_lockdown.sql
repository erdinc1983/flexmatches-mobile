-- ============================================================
-- FlexMatches — Referral RPC permission lockdown (P0 fix)
-- ============================================================
-- James caught it: award_badge_if_missing and extend_pro_by_months were
-- granted to authenticated. Since both are SECURITY DEFINER, any logged-in
-- user could do:
--
--   supabase.rpc("extend_pro_by_months", { p_user_id: myId, p_months: 999 })
--
-- and grant themselves lifetime Pro. Same for awarding any badge.
--
-- Fix:
--   1. REVOKE EXECUTE from authenticated on both helpers. They keep
--      SECURITY DEFINER so internal calls from apply_referral_rewards
--      and validate_referral still work (those run with the function
--      owner's privileges, not the caller's).
--   2. Add auth.uid() guard to apply_referral_rewards so a user can
--      only apply their OWN rewards (no triggering grants on someone
--      else's referrer_id, even though the math would be a no-op for
--      anyone without standing referrals).
-- ============================================================

-- Supabase has three relevant roles: PUBLIC (the default Postgres group),
-- `anon` (unauthenticated requests), and `authenticated` (logged-in users).
-- They're independent grant targets — revoking from PUBLIC does not revoke
-- from `anon`. Revoke from all three to fully close the hole.
REVOKE EXECUTE ON FUNCTION public.award_badge_if_missing(uuid, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.award_badge_if_missing(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.award_badge_if_missing(uuid, text) FROM public;

REVOKE EXECUTE ON FUNCTION public.extend_pro_by_months(uuid, integer, text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.extend_pro_by_months(uuid, integer, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.extend_pro_by_months(uuid, integer, text) FROM public;

-- ── Re-create apply_referral_rewards with self-only guard ─────
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
  v_caller     uuid;
BEGIN
  -- Caller can only apply their own rewards. NULL caller (service role
  -- via Edge Function) is allowed since RLS / function-level checks
  -- happen at the Edge Function boundary in that context.
  v_caller := auth.uid();
  IF v_caller IS NOT NULL AND v_caller <> p_referrer_id THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'forbidden');
  END IF;

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

-- ── Verify ────────────────────────────────────────────────────
-- Should fail when called by a logged-in user against another user's id:
--   SELECT apply_referral_rewards('<other-user-id>');  -- → forbidden
-- Should succeed when called against your own id:
--   SELECT apply_referral_rewards(auth.uid());
-- Direct helper calls should now error as not-found:
--   SELECT extend_pro_by_months(auth.uid(), 999, 'haha');  -- → permission denied
