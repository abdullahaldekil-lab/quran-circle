CREATE OR REPLACE FUNCTION public.is_app_member(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _uid IS NOT NULL AND (
    public.is_staff(_uid)
    OR EXISTS (SELECT 1 FROM public.guardian_profiles g WHERE g.id = _uid AND g.approval_status = 'approved')
  )
$$;

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('level_tracks','Authenticated can view level_tracks'),
    ('preparation_config','Anyone authenticated can read preparation config'),
    ('summer_programs','Authenticated can read summer programs'),
    ('level_branches','Authenticated can view level_branches'),
    ('madarij_tracks','Authenticated can view madarij_tracks'),
    ('level_parts','Authenticated can view level_parts'),
    ('holidays','Authenticated users can read holidays'),
    ('narration_test_settings','Anyone authenticated can read narration settings'),
    ('rewards','Authenticated can view rewards'),
    ('memorization_levels','Authenticated can view levels'),
    ('badges','Authenticated can view badges')
  ) AS t(tbl, pol) LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.pol, r.tbl);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.is_app_member(auth.uid()))', r.pol, r.tbl);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Documents files respect visibility" ON storage.objects;
CREATE POLICY "Documents files respect visibility" ON storage.objects
FOR SELECT TO authenticated USING (
  bucket_id = 'documents' AND (
    public.is_staff((select auth.uid()))
    OR (
      public.is_app_member((select auth.uid()))
      AND EXISTS (SELECT 1 FROM public.documents d WHERE d.visibility = 'all'
        AND (split_part(d.file_url, '/documents/', 2) = objects.name OR split_part(d.external_url, '/documents/', 2) = objects.name))
    )
  )
);