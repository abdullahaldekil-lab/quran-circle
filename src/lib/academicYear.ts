// التقويم الدراسي المعتمد للعام 1448 هـ (2026 – 2027 م).
//
// هذا الملف هو المصدر الوحيد لتواريخ بداية/نهاية الفصلين وأيام الدراسة،
// وتُبنى عليه الخطط ودوامات المعلمين والطلاب.
// ملاحظة مهمة: تاريخ «عودة المعلمين» غير معتمد هنا — الدراسة تبدأ من عودة
// الطلاب (بداية العام الدراسي) فقط.

export interface AcademicTermDef {
  key: "first" | "second";
  label: string;
  /** بداية الدراسة (ميلادي ISO) */
  start: string;
  /** آخر يوم دوام (ميلادي ISO) */
  end: string;
}

export interface AcademicYearDef {
  label: string;
  hijriYear: number;
  /** بداية العام الدراسي = عودة الطلاب */
  start: string;
  /** آخر يوم دوام في العام */
  end: string;
  terms: AcademicTermDef[];
}

export const ACADEMIC_YEAR: AcademicYearDef = {
  label: "1448 هـ / 2026 – 2027 م",
  hijriYear: 1448,
  start: "2026-08-23",
  end: "2027-06-24",
  terms: [
    { key: "first", label: "الفصل الدراسي الأول", start: "2026-08-23", end: "2027-01-07" },
    { key: "second", label: "الفصل الدراسي الثاني", start: "2027-01-17", end: "2027-06-24" },
  ],
};

/** إجازات العام الدراسي المعتمدة (تُزرع في جدول الإجازات أيضاً). */
export const ACADEMIC_YEAR_HOLIDAYS: { title: string; start_date: string; end_date: string }[] = [
  { title: "إجازة اليوم الوطني", start_date: "2026-09-23", end_date: "2026-09-24" },
  { title: "إجازة الخريف", start_date: "2026-11-20", end_date: "2026-11-28" },
  { title: "إجازة الفصل الدراسي الأول", start_date: "2027-01-08", end_date: "2027-01-16" },
  { title: "إجازة يوم التأسيس", start_date: "2027-02-21", end_date: "2027-02-22" },
  { title: "إجازة عيد الفطر المبارك", start_date: "2027-02-26", end_date: "2027-03-13" },
  { title: "إجازة عيد الأضحى المبارك", start_date: "2027-05-07", end_date: "2027-05-22" },
];

export interface HolidayRange {
  start_date: string;
  end_date: string;
  title?: string;
}

const toIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** نهاية الأسبوع في التقويم الأكاديمي: الجمعة والسبت. */
export const isWeekendIso = (iso: string): boolean => {
  const d = new Date(`${iso}T00:00:00`).getDay();
  return d === 5 || d === 6;
};

export const inRange = (iso: string, from: string, to: string) => iso >= from && iso <= to;

/** الفصل الدراسي الذي يقع فيه التاريخ، أو null (إجازة بين الفصلين / خارج العام). */
export const termForDate = (iso: string): AcademicTermDef | null =>
  ACADEMIC_YEAR.terms.find((t) => inRange(iso, t.start, t.end)) ?? null;

export const isWithinAcademicYear = (iso: string) =>
  inRange(iso, ACADEMIC_YEAR.start, ACADEMIC_YEAR.end);

/** الإجازة التي تشمل التاريخ إن وُجدت. */
export const holidayForDate = (
  iso: string,
  holidays: HolidayRange[] = ACADEMIC_YEAR_HOLIDAYS,
): HolidayRange | null => holidays.find((h) => inRange(iso, h.start_date, h.end_date)) ?? null;

/** يوم دراسي فعلي: داخل فصل دراسي، ليس نهاية أسبوع، وليس إجازة. */
export const isStudyDay = (
  iso: string,
  holidays: HolidayRange[] = ACADEMIC_YEAR_HOLIDAYS,
): boolean => !!termForDate(iso) && !isWeekendIso(iso) && !holidayForDate(iso, holidays);

/** عدد أيام الدراسة بين تاريخين (شاملين). */
export const countStudyDays = (
  from: string,
  to: string,
  holidays: HolidayRange[] = ACADEMIC_YEAR_HOLIDAYS,
): number => {
  if (to < from) return 0;
  let count = 0;
  const cursor = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);
  while (cursor <= end) {
    if (isStudyDay(toIso(cursor), holidays)) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
};

/** عدد أيام الدراسة في فصل. */
export const termStudyDays = (
  term: AcademicTermDef,
  holidays: HolidayRange[] = ACADEMIC_YEAR_HOLIDAYS,
): number => countStudyDays(term.start, term.end, holidays);

/** أول يوم دراسي في/بعد تاريخ معيّن، أو null إذا انتهى العام. */
export const nextStudyDay = (
  fromIso: string,
  holidays: HolidayRange[] = ACADEMIC_YEAR_HOLIDAYS,
): string | null => {
  const cursor = new Date(`${fromIso}T00:00:00`);
  for (let i = 0; i <= 400; i++) {
    const iso = toIso(cursor);
    if (iso > ACADEMIC_YEAR.end) return null;
    if (isStudyDay(iso, holidays)) return iso;
    cursor.setDate(cursor.getDate() + 1);
  }
  return null;
};
