CREATE TABLE public.talqeen_curriculum_change_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  halaqa_id UUID NOT NULL,
  old_curriculum_id UUID,
  new_curriculum_id UUID,
  affected_students_count INTEGER NOT NULL DEFAULT 0,
  changed_by UUID,
  reverted BOOLEAN NOT NULL DEFAULT false,
  reverted_at TIMESTAMPTZ,
  reverted_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_talqeen_curr_change_halaqa ON public.talqeen_curriculum_change_log(halaqa_id, created_at DESC);

ALTER TABLE public.talqeen_curriculum_change_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Manager and talqeen supervisor can view change log"
ON public.talqeen_curriculum_change_log
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.role::text IN ('manager', 'admin', 'talqeen_supervisor')
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
      AND p.role::text IN ('manager', 'admin', 'talqeen_supervisor')
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
      AND p.role::text IN ('manager', 'admin', 'talqeen_supervisor')
  )
);