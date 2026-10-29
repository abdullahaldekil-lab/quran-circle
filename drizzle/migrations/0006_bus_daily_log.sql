CREATE TABLE public.bus_daily_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bus_id uuid NOT NULL REFERENCES public.buses(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  log_date date NOT NULL DEFAULT CURRENT_DATE,
  boarded_at timestamptz,
  alighted_at timestamptz,
  absent boolean NOT NULL DEFAULT false,
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, log_date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bus_daily_log TO authenticated;
GRANT ALL ON public.bus_daily_log TO service_role;
ALTER TABLE public.bus_daily_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff manage bus daily log" ON public.bus_daily_log FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER trg_bus_daily_log_updated BEFORE UPDATE ON public.bus_daily_log
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();