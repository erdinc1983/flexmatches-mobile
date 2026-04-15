-- ============================================================
-- FlexMatches — notifications orphan cleanup + trigger
-- ============================================================
-- notifications.related_id is plain text (can point to match / user / session
-- / badge / etc depending on `type`), so no FK cascade is possible at column
-- level. Instead: a trigger on matches DELETE removes notifications whose
-- type is message/match_* and whose related_id equals the deleted match.id.
--
-- Also cleans any existing orphans from prior deletions.
-- ============================================================

-- ── One-time cleanup of existing orphans ─────────────────────
DELETE FROM public.notifications n
WHERE n.type IN ('message','new_message','match_request','match_accepted','match_rejected')
  AND n.related_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.matches m WHERE m.id::text = n.related_id
  );

-- ── Trigger: clean notifications when a match is deleted ────
CREATE OR REPLACE FUNCTION public.cascade_delete_match_notifications()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.notifications
  WHERE type IN ('message','new_message','match_request','match_accepted','match_rejected')
    AND related_id = OLD.id::text;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_cascade_delete_match_notifications ON public.matches;
CREATE TRIGGER trg_cascade_delete_match_notifications
  AFTER DELETE ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.cascade_delete_match_notifications();

-- ── Verify ───────────────────────────────────────────────────
-- SELECT trigger_name FROM information_schema.triggers
-- WHERE trigger_name = 'trg_cascade_delete_match_notifications';
