import { supabase } from "@/integrations/supabase/client";

/** الحلقات النشطة المتاحة للمستخدم: المعلم يرى حلقته فقط، والإدارة ترى الجميع. */
export const fetchMyHalaqat = async (isTeacher: boolean) => {
  const { data } = await supabase.from("halaqat").select("id, name, teacher_id, assistant_teacher_id").eq("active", true).order("name");
  let list = data || [];
  if (isTeacher) {
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user?.id;
    list = list.filter((h: any) => h.teacher_id === uid || h.assistant_teacher_id === uid);
  }
  return list.map((h: any) => ({ id: h.id as string, name: h.name as string }));
};

/** بداية الأسبوع الدراسي (الأحد) ونهايته (الخميس) بصيغة yyyy-mm-dd. */
export const currentSchoolWeek = (ref = new Date()) => {
  const d = new Date(ref);
  d.setDate(d.getDate() - d.getDay());
  const end = new Date(d);
  end.setDate(d.getDate() + 4);
  const f = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  return { from: f(d), to: f(end) };
};

/** نقاط التفوق في التسميع: مجموع الدرجات الكلية (كل تسميع 100 كحد أعلى). */
export const recitationPoints = (scores: (number | null)[]) =>
  Math.round(scores.reduce<number>((s, v) => s + (Number(v) || 0), 0));
