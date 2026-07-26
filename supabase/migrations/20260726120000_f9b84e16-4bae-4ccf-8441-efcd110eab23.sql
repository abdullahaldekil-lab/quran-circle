-- سجل عمليات التصدير إلى منصة ناظم — لتفادي تكرار تصدير الفترة نفسها.
CREATE TABLE IF NOT EXISTS public.nazem_export_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exported_by UUID REFERENCES auth.users(id),
  exported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  halaqa_id UUID REFERENCES public.halaqat(id) ON DELETE SET NULL,
  rows_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_nazem_export_log_exported_at
  ON public.nazem_export_log (exported_at DESC);

GRANT SELECT, INSERT ON public.nazem_export_log TO authenticated;
GRANT ALL ON public.nazem_export_log TO service_role;

ALTER TABLE public.nazem_export_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view nazem export log" ON public.nazem_export_log;
CREATE POLICY "Staff can view nazem export log" ON public.nazem_export_log
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Staff can insert nazem export log" ON public.nazem_export_log;
CREATE POLICY "Staff can insert nazem export log" ON public.nazem_export_log
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff(auth.uid()) AND exported_by = auth.uid());
