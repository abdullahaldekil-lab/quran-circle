DROP POLICY IF EXISTS "Manager and talqeen supervisor can view change log" ON public.talqeen_curriculum_change_log;
DROP POLICY IF EXISTS "Manager and talqeen supervisor can insert change log" ON public.talqeen_curriculum_change_log;
DROP POLICY IF EXISTS "Manager and talqeen supervisor can update change log" ON public.talqeen_curriculum_change_log;

CREATE POLICY "Manager and talqeen supervisor can view change log"
ON public.talqeen_curriculum_change_log
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role::text IN ('manager', 'admin', 'custom_1775663809732')
  )
);

CREATE POLICY "Manager and talqeen supervisor can insert change log"
ON public.talqeen_curriculum_change_log
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role::text IN ('manager', 'admin', 'custom_1775663809732')
  )
);

CREATE POLICY "Manager and talqeen supervisor can update change log"
ON public.talqeen_curriculum_change_log
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role::text IN ('manager', 'admin', 'custom_1775663809732')
  )
);