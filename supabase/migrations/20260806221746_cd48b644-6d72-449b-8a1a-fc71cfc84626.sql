CREATE TABLE public.program_material_views (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  material_id UUID NOT NULL REFERENCES public.program_materials(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  user_id UUID,
  student_code TEXT,
  event_type TEXT NOT NULL DEFAULT 'open',
  seconds_watched INTEGER NOT NULL DEFAULT 0,
  completion_percent NUMERIC NOT NULL DEFAULT 0,
  viewed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT program_material_views_event_type_check
    CHECK (event_type IN ('open','play','download','complete')),
  CONSTRAINT program_material_views_completion_check
    CHECK (completion_percent >= 0 AND completion_percent <= 100),
  CONSTRAINT program_material_views_seconds_check
    CHECK (seconds_watched >= 0 AND seconds_watched <= 200000)
);

GRANT SELECT, INSERT, UPDATE ON public.program_material_views TO authenticated;
GRANT INSERT ON public.program_material_views TO anon;
GRANT ALL ON public.program_material_views TO service_role;

ALTER TABLE public.program_material_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can log a material view"
ON public.program_material_views FOR INSERT TO anon, authenticated
WITH CHECK (true);

CREATE POLICY "Staff can read material views"
ON public.program_material_views FOR SELECT TO authenticated
USING (public.is_staff(auth.uid()));

CREATE POLICY "Staff can update material views"
ON public.program_material_views FOR UPDATE TO authenticated
USING (public.is_staff(auth.uid()))
WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "Managers can delete material views"
ON public.program_material_views FOR DELETE TO authenticated
USING (public.get_staff_role(auth.uid()) IN ('manager','supervisor'));

CREATE INDEX idx_pmv_material ON public.program_material_views(material_id);
CREATE INDEX idx_pmv_student ON public.program_material_views(student_id);
CREATE INDEX idx_pmv_viewed_at ON public.program_material_views(viewed_at DESC);

CREATE TRIGGER trg_pmv_updated
BEFORE UPDATE ON public.program_material_views
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();