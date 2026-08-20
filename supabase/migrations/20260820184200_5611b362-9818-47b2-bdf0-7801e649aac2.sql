DROP POLICY IF EXISTS "Users can view documents by visibility" ON public.documents;
CREATE POLICY "Users can view documents by visibility"
ON public.documents FOR SELECT TO authenticated
USING (
  CASE
    WHEN visibility = 'all' THEN auth.uid() IS NOT NULL
    WHEN visibility = 'admin_only' THEN get_staff_role(auth.uid()) = ANY (ARRAY['manager','supervisor','assistant_supervisor'])
    WHEN visibility = 'teachers' THEN get_staff_role(auth.uid()) IS NOT NULL
    WHEN visibility = 'guardians' THEN EXISTS (SELECT 1 FROM guardian_profiles gp WHERE gp.id = auth.uid())
    ELSE false
  END
);

DROP POLICY IF EXISTS "Documents files respect visibility" ON storage.objects;
CREATE POLICY "Documents files respect visibility"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'documents' AND auth.uid() IS NOT NULL AND (
    is_staff(auth.uid()) OR EXISTS (
      SELECT 1 FROM public.documents d
      WHERE d.visibility = 'all'
        AND (split_part(d.file_url, '/documents/', 2) = objects.name
          OR split_part(d.external_url, '/documents/', 2) = objects.name)
    )
  )
);

DROP POLICY IF EXISTS "Manager can manage documents" ON public.documents;
CREATE POLICY "Manager can manage documents"
ON public.documents FOR ALL TO authenticated
USING (get_staff_role(auth.uid()) = 'manager')
WITH CHECK (get_staff_role(auth.uid()) = 'manager');

REVOKE SELECT ON public.documents FROM anon;