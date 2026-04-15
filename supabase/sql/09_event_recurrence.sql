-- ============================================================
-- FlexMatches — Circle event recurrence (label-only, MVP)
-- ============================================================
-- Adds communities.recurrence as a plain text label. No server-side
-- expansion — event_date still stores the next concrete occurrence. The
-- circle's owner manually advances the date after each meeting (same
-- model as a recurring calendar invite the owner updates).
--
-- Allowed values (enforced by app layer, not CHECK constraint — leaves
-- room for future expansion to 'custom_rrule' etc):
--   NULL      — one-time event (default)
--   'weekly'
--   'biweekly'
--   'monthly'
-- ============================================================

ALTER TABLE public.communities
  ADD COLUMN IF NOT EXISTS recurrence text;
