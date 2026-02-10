
-- Create memorization levels table
CREATE TABLE public.memorization_levels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  target_memorization TEXT,
  daily_target TEXT,
  review_requirement TEXT,
  suitable_for TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.memorization_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view levels" ON public.memorization_levels FOR SELECT USING (true);
CREATE POLICY "Managers can manage levels" ON public.memorization_levels FOR ALL USING (true) WITH CHECK (true);

-- Seed the 5 levels
INSERT INTO public.memorization_levels (name, description, target_memorization, daily_target, review_requirement, suitable_for, sort_order) VALUES
('تمهيدي', 'تلقين، قصار السور، تصحيح التلاوة', 'من سورة الناس إلى سورة الضحى', '3–5 آيات', 'مراجعة يومية قصيرة', 'مبتدئين', 1),
('مبتدئ', 'حفظ منتظم مع أساسيات التجويد', 'من سورة الضحى إلى سورة الأعلى', 'نصف صفحة', 'مراجعة يومية للحفظ السابق', 'طلاب المرحلة الأولى', 2),
('متوسط', 'تثبيت الحفظ وتحسين الجودة', 'من سورة الأعلى إلى سورة الكهف', 'صفحة كاملة', 'مراجعة 3–5 صفحات', 'طلاب المرحلة المتوسطة', 3),
('متقدم', 'حفظ مكثف مع ضبط الأخطاء', 'من سورة الكهف إلى سورة الإسراء', 'صفحة إلى صفحتين', 'مراجعة 10 صفحات', 'طلاب المرحلة الثانوية', 4),
('متقدم جدًا', 'قرب الختم وإتقان الأداء', 'من سورة الإسراء إلى سورة الناس', 'صفحتان', 'مراجعة مستمرة للأجزاء السابقة', 'طلاب الختم', 5);
