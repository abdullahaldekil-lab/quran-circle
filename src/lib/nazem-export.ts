// Helpers for building the "ناظم" Excel export rows from recitation records.

export interface NazemRecord {
  record_date: string;
  memorized_from?: string | null;
  memorized_to?: string | null;
  memorization_grade?: number | null;
  mistakes_breakdown?: any;
  notes?: string | null;
  student_id: string;
  halaqa_id?: string | null;
}

export interface NazemStudent {
  id: string;
  full_name?: string | null;
  national_id?: string | null;
  student_code?: string | null;
}
export interface NazemHalaqa {
  id: string;
  name?: string | null;
  teacher_id?: string | null;
}
export interface NazemTeacher {
  id: string;
  full_name?: string | null;
}

export const buildNazemRow = (
  r: NazemRecord,
  studentMap: Map<string, NazemStudent>,
  halaqaMap: Map<string, NazemHalaqa>,
  teacherMap: Map<string, NazemTeacher>,
) => {
  const s = studentMap.get(r.student_id) || ({} as NazemStudent);
  const h = (r.halaqa_id && halaqaMap.get(r.halaqa_id)) || ({} as NazemHalaqa);
  const t = (h.teacher_id && teacherMap.get(h.teacher_id)) || ({} as NazemTeacher);
  const mb = r.mistakes_breakdown?.memorization || {};
  return {
    "التاريخ": r.record_date,
    "اسم الطالب": s.full_name || "",
    "رقم الهوية": s.national_id || "",
    "كود الطالب": s.student_code || "",
    "الحلقة": h.name || "",
    "المعلم": t.full_name || "",
    "من": r.memorized_from || "",
    "إلى": r.memorized_to || "",
    "الدرجة": r.memorization_grade ?? "",
    "أخطاء": mb.error || 0,
    "لحن": mb.lahn || 0,
    "تنبيه": mb.warning || 0,
    "ملاحظات": r.notes || "",
  };
};
