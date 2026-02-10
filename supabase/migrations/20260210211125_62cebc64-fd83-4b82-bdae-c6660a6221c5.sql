
-- Points ledger (append-only, no manual edits)
CREATE TABLE public.student_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  points integer NOT NULL,
  reason text NOT NULL,
  source_type text NOT NULL DEFAULT 'system', -- system, recitation, attendance
  source_id uuid, -- optional reference to recitation_record or attendance
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.student_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view points" ON public.student_points FOR SELECT TO authenticated USING (true);
CREATE POLICY "System can insert points" ON public.student_points FOR INSERT TO authenticated WITH CHECK (true);

-- Badge definitions
CREATE TABLE public.badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  icon text NOT NULL DEFAULT 'award',
  category text NOT NULL DEFAULT 'achievement', -- achievement, attendance, milestone, excellence
  criteria_type text, -- weekly_excellence, perfect_attendance, mistake_reduction, memorization_milestone
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view badges" ON public.badges FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers can manage badges" ON public.badges FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Student awarded badges
CREATE TABLE public.student_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  badge_id uuid REFERENCES public.badges(id) ON DELETE CASCADE NOT NULL,
  awarded_at timestamptz NOT NULL DEFAULT now(),
  awarded_by uuid REFERENCES public.profiles(id),
  note text
);

ALTER TABLE public.student_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view student badges" ON public.student_badges FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can award badges" ON public.student_badges FOR INSERT TO authenticated WITH CHECK (true);

-- Material rewards (defined by manager)
CREATE TABLE public.rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  reward_type text NOT NULL DEFAULT 'certificate', -- certificate, gift, trip, recognition
  points_required integer DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.rewards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view rewards" ON public.rewards FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers can manage rewards" ON public.rewards FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Reward nominations (teacher nominates, manager approves)
CREATE TABLE public.reward_nominations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
  reward_id uuid REFERENCES public.rewards(id) ON DELETE CASCADE NOT NULL,
  nominated_by uuid REFERENCES public.profiles(id) NOT NULL,
  approved_by uuid REFERENCES public.profiles(id),
  status text NOT NULL DEFAULT 'pending', -- pending, approved, rejected
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reward_nominations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view nominations" ON public.reward_nominations FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage nominations" ON public.reward_nominations FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Seed default badges
INSERT INTO public.badges (name, description, icon, category, criteria_type) VALUES
  ('تميز أسبوعي', 'أعلى درجة في الأسبوع', 'star', 'excellence', 'weekly_excellence'),
  ('حضور مثالي', 'حضور كامل لمدة شهر', 'calendar-check', 'attendance', 'perfect_attendance'),
  ('تحسن ملحوظ', 'انخفاض ملحوظ في الأخطاء', 'trending-down', 'achievement', 'mistake_reduction'),
  ('إتمام جزء', 'إتمام حفظ جزء كامل', 'book-open', 'milestone', 'memorization_milestone'),
  ('إتمام حزب', 'إتمام حفظ حزب كامل', 'bookmark', 'milestone', 'memorization_milestone'),
  ('ختم القرآن', 'إتمام حفظ القرآن الكريم كاملاً', 'crown', 'milestone', 'memorization_milestone'),
  ('المثابرة', 'حفظ يومي متواصل لمدة أسبوعين', 'flame', 'achievement', 'consistency'),
  ('الإتقان', 'درجة 95+ في 5 تسميعات متتالية', 'gem', 'excellence', 'mastery');
