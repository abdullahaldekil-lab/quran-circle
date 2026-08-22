/**
 * مسار الحفظ داخل برنامج مدارج.
 *
 * المسار الوحيد المعتمد: سرعة يومية إما نصف وجه أو وجه كامل. كل الحسابات
 * (المقدار اليومي، الأيام المتبقية، تاريخ الانتهاء المتوقع، نسبة الالتزام)
 * تنبع من هذه السرعة، وأيام الدراسة من الأحد إلى الخميس مع استثناء الإجازات.
 */

export const PAGES_PER_HIZB = 10;
export const PAGES_PER_JUZ = 20;

export type DailyPace = 0.5 | 1;

export const DAILY_PACE_OPTIONS: { value: DailyPace; label: string }[] = [
  { value: 0.5, label: "نصف وجه يومياً" },
  { value: 1, label: "وجه كامل يومياً" },
];

/** يوحّد أي قيمة قادمة من قاعدة البيانات إلى سرعة صالحة. */
export const normalizePace = (value: unknown): DailyPace => (Number(value) === 0.5 ? 0.5 : 1);

export const paceLabel = (value: unknown): string =>
  normalizePace(value) === 0.5 ? "نصف وجه يومياً" : "وجه كامل يومياً";

const toDate = (d: string | Date): Date => (typeof d === "string" ? new Date(`${d}T00:00:00`) : new Date(d));
const iso = (d: Date): string => d.toISOString().split("T")[0];

/** أيام الدراسة: الأحد–الخميس، مع استثناء الإجازات الرسمية. */
export const isStudyDay = (date: string | Date, holidays: string[] = []): boolean => {
  const d = toDate(date);
  const dow = d.getDay(); // 5 = الجمعة، 6 = السبت
  if (dow === 5 || dow === 6) return false;
  return !holidays.includes(iso(d));
};

/** عدد أيام الدراسة بين تاريخين (شاملين). */
export const countStudyDays = (from: string | Date, to: string | Date, holidays: string[] = []): number => {
  const start = toDate(from);
  const end = toDate(to);
  if (end < start) return 0;
  let count = 0;
  const cur = new Date(start);
  // حد أعلى وقائي لتجنّب أي حلقة غير منتهية
  for (let i = 0; i < 2000 && cur <= end; i += 1) {
    if (isStudyDay(cur, holidays)) count += 1;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
};

/** تاريخ اليوم الدراسي رقم `days` بدءاً من تاريخ البداية. */
export const addStudyDays = (start: string | Date, days: number, holidays: string[] = []): string | null => {
  if (days <= 0) return null;
  const cur = toDate(start);
  let counted = 0;
  for (let i = 0; i < 3000; i += 1) {
    if (isStudyDay(cur, holidays)) {
      counted += 1;
      if (counted >= days) return iso(cur);
    }
    cur.setDate(cur.getDate() + 1);
  }
  return null;
};

/** عدد أيام الدراسة اللازمة لحفظ مقدار معيّن بالأوجه. */
export const daysNeededFor = (pages: number, pace: unknown): number => {
  const p = normalizePace(pace);
  if (!(pages > 0)) return 0;
  return Math.ceil(pages / p);
};

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";

/** يستخرج عدد الأوجه من نص المتابعة اليومية (يدعم الأرقام العربية والكسور). */
export const parsePagesFromText = (text?: string | null): number | null => {
  if (!text) return null;
  const normalized = text.replace(/[٠-٩]/g, (c) => String(ARABIC_DIGITS.indexOf(c)));
  const match = normalized.match(/(\d+(?:[.,]\d+)?)/);
  if (!match) return null;
  const value = Number(match[1].replace(",", "."));
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.min(value, 20);
};

export interface DailyRecordLike {
  progress_date?: string | null;
  memorization?: string | null;
}

/**
 * الأوجه المنجزة فعلياً: يُقرأ الرقم من نص الحفظ إن وُجد، وإلا يُحسب اليوم
 * المُسجَّل بمقدار السرعة اليومية.
 */
export const achievedPages = (records: DailyRecordLike[], pace: unknown): number => {
  const p = normalizePace(pace);
  return (records || []).reduce((sum, r) => {
    const text = (r.memorization || "").trim();
    if (!text) return sum;
    return sum + (parsePagesFromText(text) ?? p);
  }, 0);
};

export interface PaceSummary {
  pace: DailyPace;
  paceLabel: string;
  /** المقدار اليومي المطلوب بالأوجه */
  dailyPages: number;
  daysForHizb: number;
  daysForJuz: number;
  /** تاريخ إتمام الحزب الحالي المتوقع */
  expectedHizbEnd: string | null;
  /** تاريخ إتمام الجزء المتوقع */
  expectedJuzEnd: string | null;
  /** المستهدف حتى تاريخ اليوم */
  targetToDate: number;
  achieved: number;
  commitment: number;
  /** موجب = متقدم، سالب = متأخر (بالأيام) */
  daysAhead: number;
}

export const buildPaceSummary = (opts: {
  pace: unknown;
  startDate: string;
  today?: string;
  records?: DailyRecordLike[];
  holidays?: string[];
}): PaceSummary => {
  const pace = normalizePace(opts.pace);
  const today = opts.today || new Date().toISOString().split("T")[0];
  const holidays = opts.holidays || [];
  const daysForHizb = daysNeededFor(PAGES_PER_HIZB, pace);
  const daysForJuz = daysNeededFor(PAGES_PER_JUZ, pace);
  const studyDaysSoFar = countStudyDays(opts.startDate, today, holidays);
  const targetToDate = Number((studyDaysSoFar * pace).toFixed(2));
  const achieved = Number(achievedPages(opts.records || [], pace).toFixed(2));
  const commitment = targetToDate > 0 ? Math.round((achieved / targetToDate) * 100) : 0;
  const daysAhead = Number(((achieved - targetToDate) / pace).toFixed(1));

  return {
    pace,
    paceLabel: paceLabel(pace),
    dailyPages: pace,
    daysForHizb,
    daysForJuz,
    expectedHizbEnd: addStudyDays(opts.startDate, daysForHizb, holidays),
    expectedJuzEnd: addStudyDays(opts.startDate, daysForJuz, holidays),
    targetToDate,
    achieved,
    commitment,
    daysAhead,
  };
};

/** لون شريط الالتزام: أخضر ≥ 85%، أصفر 60–84%، أحمر < 60%. */
export const commitmentTone = (pct: number): "success" | "warning" | "danger" =>
  pct >= 85 ? "success" : pct >= 60 ? "warning" : "danger";
