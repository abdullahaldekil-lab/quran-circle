-- البُعد الفصلي للخطة، وضبط تفرّد صفوف التقدم، وأساس المحفوظ للطالب.

-- 1) الفصل الدراسي على الخطة. TEXT + CHECK بدل enum: الـ enum العربية في هذا
--    المخطط يصعب تعديلها لاحقًا (لا DROP VALUE، و ADD VALUE لا يشارك معاملة
--    استخدامه)، والتوسعة هنا تحتاج تعديل قيد واحد فقط.
ALTER TABLE public.student_annual_plans
  ADD COLUMN IF NOT EXISTS term TEXT NOT NULL DEFAULT 'annual',
  ADD COLUMN IF NOT EXISTS term_label TEXT;

ALTER TABLE public.student_annual_plans
  DROP CONSTRAINT IF EXISTS student_annual_plans_term_check;
ALTER TABLE public.student_annual_plans
  ADD CONSTRAINT student_annual_plans_term_check
  CHECK (term IN ('annual', 'first', 'second', 'summer'));

-- 2) صفوف التقدم الشهري بلا مفتاح فريد، فإعادة حفظ الخطة كانت تُنشئ صفوفًا
--    مكرّرة للشهر نفسه. ننظّف المكرّر (نُبقي الأحدث) ثم نضيف القيد.
DELETE FROM public.student_plan_progress a
 USING public.student_plan_progress b
 WHERE a.plan_id = b.plan_id
   AND a.month_number = b.month_number
   AND a.ctid < b.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS uq_plan_progress_plan_month
  ON public.student_plan_progress (plan_id, month_number);

-- 3) صار من المشروع وجود أكثر من خطة نشطة للطالب (سنوية + صيفية مثلًا)، لذا
--    التفرّد صار لكل فصل. ننهي المكرّر القديم أولًا حتى لا يفشل إنشاء الفهرس.
UPDATE public.student_annual_plans p
   SET status = 'suspended'
 WHERE p.status = 'active'
   AND EXISTS (
     SELECT 1 FROM public.student_annual_plans q
      WHERE q.student_id = p.student_id
        AND q.academic_year = p.academic_year
        AND q.term = p.term
        AND q.status = 'active'
        AND q.created_at > p.created_at
   );

CREATE UNIQUE INDEX IF NOT EXISTS uq_active_plan_per_term
  ON public.student_annual_plans (student_id, academic_year, term)
  WHERE status = 'active';

-- 4) أساس المحفوظ. students.total_memorized_pages موجود لكن لم يكتب فيه أي مسار
--    في الشيفرة، فكل أشرطة "س/604" ومؤشر الختم أصفار دائمًا.
CREATE TABLE IF NOT EXISTS public.student_memorization_baseline (
  student_id UUID PRIMARY KEY REFERENCES public.students(id) ON DELETE CASCADE,
  baseline_pages INTEGER NOT NULL DEFAULT 0 CHECK (baseline_pages BETWEEN 0 AND 604),
  baseline_up_to_page INTEGER CHECK (baseline_up_to_page BETWEEN 1 AND 604),
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('plan', 'manual', 'legacy_text', 'import')),
  note TEXT,
  set_by UUID DEFAULT auth.uid(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.student_memorization_baseline TO authenticated;
GRANT ALL ON public.student_memorization_baseline TO service_role;

ALTER TABLE public.student_memorization_baseline ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff can view memorization baseline" ON public.student_memorization_baseline;
CREATE POLICY "Staff can view memorization baseline" ON public.student_memorization_baseline
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "Managers can manage memorization baseline" ON public.student_memorization_baseline;
CREATE POLICY "Managers can manage memorization baseline" ON public.student_memorization_baseline
  FOR ALL TO authenticated
  USING (public.get_staff_role(auth.uid()) = ANY (ARRAY['manager', 'supervisor', 'assistant_supervisor']))
  WITH CHECK (public.get_staff_role(auth.uid()) = ANY (ARRAY['manager', 'supervisor', 'assistant_supervisor']));

-- تعبئة أولية من الخطط القائمة حتى لا تبدأ الشاشات بأصفار.
INSERT INTO public.student_memorization_baseline (student_id, baseline_pages, baseline_up_to_page, source)
SELECT DISTINCT ON (p.student_id)
       p.student_id,
       LEAST(604, GREATEST(0, COALESCE(p.previous_memorized_pages, 0))),
       NULLIF(GREATEST(1, LEAST(604, COALESCE(p.previous_memorized_pages, 0))), 0),
       'plan'
  FROM public.student_annual_plans p
 WHERE COALESCE(p.previous_memorized_pages, 0) > 0
 ORDER BY p.student_id, p.created_at DESC
ON CONFLICT (student_id) DO NOTHING;

UPDATE public.students s
   SET total_memorized_pages = b.baseline_pages
  FROM public.student_memorization_baseline b
 WHERE b.student_id = s.id
   AND COALESCE(s.total_memorized_pages, 0) = 0;
