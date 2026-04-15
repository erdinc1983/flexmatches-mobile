-- ============================================================
-- FlexMatches — Pro expiry enforcement (server-side truth)
-- ============================================================
-- pro_expires_at was being SET correctly by extend_pro_by_months but
-- never CONSUMED. Result: "3 months Pro" was effectively permanent.
--
-- This adds:
--   • expire_referral_pro() — flips is_pro=false for users whose
--     pro_expires_at < now() AND pro_source IS NOT 'founding_member'.
--     Also clears pro_source so they don't show "FOUNDING" badge by
--     accident.
--   • pg_cron job: runs hourly at :07 (off-peak, doesn't collide with
--     our other top-of-hour cleanups).
--
-- Founding members are explicitly preserved because Mara's spec is "first
-- 1,000 users get Founding Pro automatically" with no expiry. Their
-- pro_expires_at may still get set later (e.g. they earn a referral Pro
-- on top), but is_pro stays true regardless.
-- ============================================================

CREATE OR REPLACE FUNCTION public.expire_referral_pro()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  WITH expired AS (
    UPDATE public.users
    SET is_pro     = false,
        pro_source = NULL
    WHERE is_pro = true
      AND COALESCE(pro_source, '') <> 'founding_member'
      AND pro_expires_at IS NOT NULL
      AND pro_expires_at < now()
    RETURNING id
  )
  SELECT COUNT(*) INTO v_count FROM expired;
  RETURN v_count;
END;
$$;

-- Helper not directly callable — only the cron job + service role.
REVOKE EXECUTE ON FUNCTION public.expire_referral_pro() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_referral_pro() FROM anon;
REVOKE EXECUTE ON FUNCTION public.expire_referral_pro() FROM public;

-- ── Cron job: hourly at :07 ──────────────────────────────────
-- pg_cron is already enabled (from 02_pg_cron.sql). Schedule the new job;
-- harmless if already scheduled.
DO $$
BEGIN
  PERFORM cron.unschedule('referral-pro-expiry');
EXCEPTION WHEN OTHERS THEN
  -- not scheduled yet — fine
  NULL;
END $$;

SELECT cron.schedule(
  'referral-pro-expiry',
  '7 * * * *',                    -- every hour at :07
  $$ SELECT public.expire_referral_pro(); $$
);

-- ── Verify ────────────────────────────────────────────────────
-- SELECT * FROM cron.job WHERE jobname = 'referral-pro-expiry';
-- SELECT expire_referral_pro();  -- run on demand, returns expired count
