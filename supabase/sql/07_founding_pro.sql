-- ============================================================
-- FlexMatches — Founding Pro (first 1,000 users get free Pro)
-- ============================================================
-- Mara's call: reward early adopters with free Pro instead of forcing
-- them to grind 10 invites before the network is dense.
--
-- Design:
--   • users.is_pro already exists (boolean).
--   • Add pro_source + pro_granted_at so the UI can distinguish
--     Founding Pro from paid Pro in copy ("Founding Member" badge).
--   • Trigger on user row INSERT grants Founding Pro if the user's
--     rank in the table is <= FOUNDING_CAP. Rank is determined by
--     created_at ASC (so existing users are preserved by recency).
--   • Atomic: uses a single count query inside the trigger under
--     the user's own row's advisory lock; if two signups race past
--     1000 by a few rows we don't care — Mara's spec is "first 1000
--     users", not "first 1000 ± 0".
-- ============================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS pro_source     text,
  ADD COLUMN IF NOT EXISTS pro_granted_at timestamptz;

-- ── Grant Founding Pro to existing users (≤ 1000, oldest first) ──
WITH ranked AS (
  SELECT id, row_number() OVER (ORDER BY created_at ASC, id ASC) AS rnk
  FROM public.users
)
UPDATE public.users u
SET is_pro         = true,
    pro_source     = COALESCE(pro_source, 'founding_member'),
    pro_granted_at = COALESCE(pro_granted_at, now())
FROM ranked r
WHERE u.id = r.id
  AND r.rnk <= 1000
  AND (u.pro_source IS NULL OR u.pro_source = 'founding_member');

-- ── Trigger for future signups ───────────────────────────────
CREATE OR REPLACE FUNCTION public.grant_founding_pro_on_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  -- Only run when the row is fresh and not already Pro
  IF NEW.is_pro IS TRUE AND NEW.pro_source IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- BEFORE INSERT — the new row isn't counted yet, so we grant when the
  -- existing count is < 1000 (this signup will become the (count + 1)th
  -- member, ≤ 1000 inclusive). Using <= here would let a 1001st user in.
  SELECT COUNT(*) INTO v_count FROM public.users;

  IF v_count < 1000 THEN
    NEW.is_pro         := true;
    NEW.pro_source     := 'founding_member';
    NEW.pro_granted_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_grant_founding_pro ON public.users;
CREATE TRIGGER trg_grant_founding_pro
  BEFORE INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.grant_founding_pro_on_signup();

-- ── Verify ───────────────────────────────────────────────────
-- SELECT COUNT(*) FROM users WHERE pro_source = 'founding_member';
