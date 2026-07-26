-- إصلاح: اعتماد استئذان ولي الأمر كان يفشل دائمًا.
--
-- الدالة apply_approved_excuse تكتب في العمود attendance.notes، والعمود الحقيقي
-- اسمه note (مفرد) كما أُنشئ في 20260210155714. أي محاولة لاعتماد طلب استئذان
-- كانت ترفع 42703 فيُلغى التحديث بالكامل.
--
-- وأُضيف كذلك تخطّي الطلاب بلا حلقة، لأن attendance.halaqa_id لا يقبل NULL
-- فكان الإدراج يفشل لهم حتى بعد تصحيح اسم العمود.

CREATE OR REPLACE FUNCTION public.apply_approved_excuse()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d DATE;
  v_halaqa_id UUID;
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    SELECT halaqa_id INTO v_halaqa_id FROM public.students WHERE id = NEW.student_id;

    -- attendance.halaqa_id is NOT NULL — a student with no halaqa cannot get rows.
    IF v_halaqa_id IS NULL THEN
      RETURN NEW;
    END IF;

    d := NEW.date_from;
    WHILE d <= NEW.date_to LOOP
      -- Skip Friday (5) and Saturday (6)
      IF EXTRACT(DOW FROM d) NOT IN (5, 6) THEN
        INSERT INTO public.attendance (student_id, halaqa_id, attendance_date, status, note)
        VALUES (NEW.student_id, v_halaqa_id, d, 'excused', 'استئذان مسبق: ' || COALESCE(NEW.reason, ''))
        ON CONFLICT (student_id, attendance_date) DO UPDATE
          SET status = 'excused',
              note = COALESCE(public.attendance.note, '') || ' | استئذان مسبق';
      END IF;
      d := d + INTERVAL '1 day';
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_approved_excuse() FROM PUBLIC, anon, authenticated;
