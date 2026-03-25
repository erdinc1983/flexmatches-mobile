-- Add field/venue, max_members, event_date, event_time columns to communities table
ALTER TABLE public.communities ADD COLUMN IF NOT EXISTS field text;
ALTER TABLE public.communities ADD COLUMN IF NOT EXISTS max_members integer;
ALTER TABLE public.communities ADD COLUMN IF NOT EXISTS event_date text;
ALTER TABLE public.communities ADD COLUMN IF NOT EXISTS event_time text;
NOTIFY pgrst, 'reload schema';
