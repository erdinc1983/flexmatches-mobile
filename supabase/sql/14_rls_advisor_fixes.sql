-- ============================================================
-- FlexMatches — RLS advisor fixes (2026-04-14)
-- ============================================================
-- Supabase Security Advisor flagged two public tables without RLS:
--
--   1. referral_grants  — I missed this when I created the table in
--      10_referral_rewards.sql. No rows populated yet, but without RLS
--      any authenticated client could SELECT the full grant ledger
--      (minor privacy leak — "who got which Pro tier and when") and
--      INSERT/DELETE rows manipulating their own tracked progress.
--      The SECURITY DEFINER functions that legitimately write here
--      bypass RLS, so enabling it doesn't break the happy path.
--
--   2. affiliate_clicks — product affiliate tracking table (currently
--      1 test row). Without RLS any user could SELECT the full click
--      history of every user (privacy leak) or INSERT fabricated
--      attribution events. Users should only see / create their own
--      clicks.
-- ============================================================

-- ── referral_grants ──────────────────────────────────────────
ALTER TABLE public.referral_grants ENABLE ROW LEVEL SECURITY;

-- A user can see their own reward grants (so the Referral screen
-- can show "you unlocked tier 3 Pro on [date]"). Nobody else's.
DROP POLICY IF EXISTS "referral_grants_self_select" ON public.referral_grants;
CREATE POLICY "referral_grants_self_select" ON public.referral_grants
  FOR SELECT USING (referrer_id = auth.uid());

-- No client-side writes. The only legitimate write path is
-- private_apply_referral_rewards (SECURITY DEFINER), which runs
-- with the function owner's privileges and bypasses RLS.
-- Explicit denial for the authenticated role — belt & suspenders
-- on top of "no INSERT/UPDATE/DELETE policy means deny by default."
-- (We don't need to add FOR INSERT/UPDATE/DELETE policies at all —
-- leaving them absent already denies. Just documenting intent here.)

-- ── affiliate_clicks ─────────────────────────────────────────
ALTER TABLE public.affiliate_clicks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "affiliate_clicks_self_select" ON public.affiliate_clicks;
CREATE POLICY "affiliate_clicks_self_select" ON public.affiliate_clicks
  FOR SELECT USING (user_id = auth.uid());

-- Users can insert their own click events (tracking pixel fired from
-- the app). user_id must match auth.uid() — prevents forging clicks
-- attributed to someone else.
DROP POLICY IF EXISTS "affiliate_clicks_self_insert" ON public.affiliate_clicks;
CREATE POLICY "affiliate_clicks_self_insert" ON public.affiliate_clicks
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- UPDATE/DELETE not allowed — clicks are an immutable audit log.
-- Omitting policies for those commands denies by default.

-- ── Verify ───────────────────────────────────────────────────
-- SELECT relname, relrowsecurity FROM pg_class c
-- JOIN pg_namespace n ON n.oid = c.relnamespace
-- WHERE n.nspname = 'public'
--   AND relname IN ('referral_grants','affiliate_clicks');
-- Expected: relrowsecurity = true for both.
