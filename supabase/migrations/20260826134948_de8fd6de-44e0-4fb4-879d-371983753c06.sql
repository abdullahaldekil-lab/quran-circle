CREATE POLICY "Talqeen supervisor can insert talqeen halaqat"
ON public.halaqat FOR INSERT TO authenticated
WITH CHECK (
  public.get_staff_role(auth.uid()) = 'custom_1775663809732'
  AND (talqeen_curriculum_id IS NOT NULL OR name ILIKE '%تلقين%')
);

CREATE POLICY "Talqeen supervisor can update talqeen halaqat"
ON public.halaqat FOR UPDATE TO authenticated
USING (
  public.get_staff_role(auth.uid()) = 'custom_1775663809732'
  AND (talqeen_curriculum_id IS NOT NULL OR name ILIKE '%تلقين%')
)
WITH CHECK (
  public.get_staff_role(auth.uid()) = 'custom_1775663809732'
  AND (talqeen_curriculum_id IS NOT NULL OR name ILIKE '%تلقين%')
);

CREATE POLICY "Talqeen supervisor can delete talqeen halaqat"
ON public.halaqat FOR DELETE TO authenticated
USING (
  public.get_staff_role(auth.uid()) = 'custom_1775663809732'
  AND (talqeen_curriculum_id IS NOT NULL OR name ILIKE '%تلقين%')
);