-- View for Tahfeez halaqat only (excludes Talqeen)
CREATE OR REPLACE VIEW public.halaqat_tahfeez
WITH (security_invoker=on) AS
SELECT *
FROM public.halaqat
WHERE talqeen_curriculum_id IS NULL
  AND COALESCE(name, '') NOT LIKE '%تلقين%';

-- View for Talqeen halaqat only
CREATE OR REPLACE VIEW public.halaqat_talqeen_only
WITH (security_invoker=on) AS
SELECT *
FROM public.halaqat
WHERE talqeen_curriculum_id IS NOT NULL
   OR COALESCE(name, '') LIKE '%تلقين%';

-- Grants (inherit RLS from base table via security_invoker)
GRANT SELECT ON public.halaqat_tahfeez TO authenticated, anon;
GRANT SELECT ON public.halaqat_talqeen_only TO authenticated, anon;

COMMENT ON VIEW public.halaqat_tahfeez IS 'Tahfeez halaqat only — excludes any halaqa linked to a Talqeen curriculum or whose name contains "تلقين".';
COMMENT ON VIEW public.halaqat_talqeen_only IS 'Talqeen halaqat only — includes any halaqa linked to a Talqeen curriculum or whose name contains "تلقين".';