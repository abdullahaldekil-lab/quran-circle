CREATE TABLE IF NOT EXISTS public.prayer_times_cache (
  prayer_date DATE PRIMARY KEY,
  fajr TEXT,
  dhuhr TEXT,
  asr TEXT,
  maghrib TEXT,
  isha TEXT,
  date TEXT,
  hijri_date TEXT,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.prayer_times_cache TO anon, authenticated;
GRANT ALL ON public.prayer_times_cache TO service_role;

ALTER TABLE public.prayer_times_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read prayer times" ON public.prayer_times_cache;
CREATE POLICY "Anyone can read prayer times" ON public.prayer_times_cache
  FOR SELECT TO anon, authenticated USING (true);