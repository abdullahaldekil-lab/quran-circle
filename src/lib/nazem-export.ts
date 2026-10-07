// Helpers for building the "ناظم" Excel export rows from recitation records.

/**
 * Shape of a `recitation_records` row as selected for the Nazem export.
 * Keep the field names aligned with the real table columns — there is no
 * `memorization_grade` column on `recitation_records`; the grade is `total_score`.
 */
export interface NazemRecord {
  record_date: string;
  memorized_from?: string | null;
  memorized_to?: string | null;
  total_score?: number | null;
  mistakes_breakdown?: any;
  notes?: string | null;
  student_id: string;
  halaqa_id?: string | null;
}

export interface NazemStudent {
  id: string;
  full_name?: string | null;
  national_id?: string | null;
  guardian_work?: string | null;
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
    "عمل ولي الأمر": s.guardian_work || "",
    "كود الطالب": s.student_code || "",
    "الحلقة": h.name || "",
    "المعلم": t.full_name || "",
    "من": r.memorized_from || "",
    "إلى": r.memorized_to || "",
    "الدرجة": r.total_score ?? "",
    "أخطاء": mb.error || 0,
    "لحن": mb.lahn || 0,
    "تنبيه": mb.warning || 0,
    "ملاحظات": r.notes || "",
  };
};

const ATT_AR: Record<string, string> = { present: "حاضر", absent: "غائب", late: "متأخر", excused: "مستأذن", late_excused: "متأخر بعذر" };

export interface NazemAttendance { student_id: string; attendance_date: string; status: string; halaqa_id?: string | null }
export interface NazemFullRecord extends NazemRecord {
  review_from?: string | null; review_to?: string | null; linking_from?: string | null; linking_to?: string | null;
}
export interface NazemGuardianStudent extends NazemStudent { guardian_name?: string | null; guardian_phone?: string | null }

const rng = (a?: string | null, b?: string | null) => (a ? `${a}${b ? ` - ${b}` : ""}` : "");

/** One row per student per day: attendance + new memorization, review, linking, score. */
export const buildDailyRows = (
  records: NazemFullRecord[], attendance: NazemAttendance[],
  studentMap: Map<string, NazemGuardianStudent>, halaqaMap: Map<string, NazemHalaqa>,
) => {
  const keys = new Map<string, { sid: string; date: string; hid?: string | null }>();
  attendance.forEach((a) => keys.set(`${a.student_id}|${a.attendance_date}`, { sid: a.student_id, date: a.attendance_date, hid: a.halaqa_id }));
  records.forEach((r) => { const k = `${r.student_id}|${r.record_date}`; if (!keys.has(k)) keys.set(k, { sid: r.student_id, date: r.record_date, hid: r.halaqa_id }); });
  return [...keys.values()].sort((a, b) => a.date.localeCompare(b.date)).map(({ sid, date, hid }) => {
    const s = studentMap.get(sid) || ({} as NazemGuardianStudent);
    const att = attendance.find((a) => a.student_id === sid && a.attendance_date === date);
    const recs = records.filter((r) => r.student_id === sid && r.record_date === date);
    const r = recs[0] || ({} as NazemFullRecord);
    const mb = r.mistakes_breakdown?.memorization || {};
    return {
      "التاريخ": date, "اسم الطالب": s.full_name || "", "رقم الهوية": s.national_id || "", "كود الطالب": s.student_code || "",
      "الحلقة": (hid && halaqaMap.get(hid)?.name) || "", "الحضور": att ? ATT_AR[att.status] || att.status : "",
      "الحفظ الجديد": rng(r.memorized_from, r.memorized_to), "المراجعة": rng(r.review_from, r.review_to), "الربط": rng(r.linking_from, r.linking_to),
      "الدرجة": r.total_score ?? "", "أخطاء": mb.error || 0, "لحن": mb.lahn || 0, "تنبيه": mb.warning || 0,
      "ولي الأمر": s.guardian_name || "", "جوال ولي الأمر": s.guardian_phone || "", "عمل ولي الأمر": s.guardian_work || "",
      "ملاحظات": r.notes || "",
    };
  });
};

/** One row per student: attendance %, memorization sessions, average score. */
export const buildGuardianSummary = (
  records: NazemFullRecord[], attendance: NazemAttendance[], studentMap: Map<string, NazemGuardianStudent>,
) => {
  const ids = new Set([...records.map((r) => r.student_id), ...attendance.map((a) => a.student_id)]);
  return [...ids].map((sid) => {
    const s = studentMap.get(sid) || ({} as NazemGuardianStudent);
    const att = attendance.filter((a) => a.student_id === sid && a.status !== "excused");
    const pres = att.filter((a) => a.status !== "absent").length;
    const recs = records.filter((r) => r.student_id === sid);
    const scores = recs.map((r) => Number(r.total_score)).filter((n) => !isNaN(n) && n > 0);
    return {
      "اسم الطالب": s.full_name || "", "رقم الهوية": s.national_id || "", "ولي الأمر": s.guardian_name || "",
      "جوال ولي الأمر": s.guardian_phone || "", "عمل ولي الأمر": s.guardian_work || "",
      "أيام الحضور": pres, "أيام الغياب": att.length - pres, "نسبة الحضور": att.length ? `${Math.round((pres / att.length) * 100)}%` : "",
      "جلسات الحفظ": recs.filter((r) => r.memorized_to).length, "آخر حفظ": recs.filter((r) => r.memorized_to).slice(-1)[0]?.memorized_to || "",
      "متوسط الدرجات": scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : "",
    };
  });
};
