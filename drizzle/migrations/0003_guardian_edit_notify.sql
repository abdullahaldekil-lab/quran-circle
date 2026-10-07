CREATE OR REPLACE FUNCTION public.notify_guardian_edit() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE sname text;
BEGIN
  SELECT full_name INTO sname FROM public.students WHERE id = NEW.student_id;
  INSERT INTO public.notifications(user_id, title, body, channel, status, meta_data)
  SELECT p.id, 'تعديل بيانات من ولي الأمر', 'قام ولي أمر الطالب ' || coalesce(sname,'') || ' بتعديل بياناته', 'inApp', 'sent',
         jsonb_build_object('link', '/students/' || NEW.student_id, 'student_id', NEW.student_id)
  FROM public.profiles p WHERE p.role IN ('manager','secretary');
  RETURN NEW;
END $$;
CREATE TRIGGER trg_notify_guardian_edit AFTER INSERT ON public.guardian_edit_log FOR EACH ROW EXECUTE FUNCTION public.notify_guardian_edit();