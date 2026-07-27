// Scoring + mechanics for the printed summer maqra cards.
//
// Source of truth = the two official cards:
//   بطاقة الحفظ (hifz)   : المقدار الجديد 15 + الربط على مقرئ 15 + الاستماع 5 + التكرار 5 = 40
//   دورة تعاهد (taahud)  : المقدار الجديد 15 + الربط على مقرئ 15 + الربط على زميل 5 + التكرار 5 = 40
//
// Deductions in both cards: خطأ/لحن = -3 درجات ، تنبيه = -1 درجة.
// hifz  : يُحتسب اللحن والتنبيه من أول مرة.
// taahud: يُحتسب اللحن من أول مرة ويُحتسب التنبيه من الثالث.

export type PlanType = "hifz" | "taahud";

export const MISTAKE_PENALTY = 3;
export const NOTIFICATION_PENALTY = 1;
/** ما يعادل الخطأ الواحد من تنبيهات. */
export const NOTIFICATIONS_PER_MISTAKE = 3;
/** أقل زمن لقراءة الحزب الواحد (دقائق) — أقل من ذلك تلزم الإعادة. */
export const MIN_HIZB_MINUTES = 12;
/** التأني: زمن الوجه الواحد لكل نوع خطة. */
export const PACE_PER_WAJH: Record<PlanType, string> = {
  hifz: "1:15",
  taahud: "1:30",
};
/** التخلف عن البرنامج هذا العدد من الأيام (ولو غير متتابعة) يعرّض للاستبعاد. */
export const ABSENCE_LIMIT = 3;

export interface DailyRecordInput {
  plan_type: PlanType;
  // المقدار الجديد
  new_notifications: number;
  new_mistakes_lahn: number;
  // الربط على مقرئ
  link_notifications: number;
  link_mistakes_lahn: number;
  // الاستماع والتكرار (حسب المسار)
  listening_count: number;
  repetitions_count: number;
  plan_track?: string | null;
  /** الربط على زميل (تعاهد فقط، 0..5). */
  link_peer_score: number;
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
const round1 = (n: number) => Math.round(n * 10) / 10;

/** التنبيهات المحتسبة فعلياً: في التعاهد تبدأ من التنبيه الثالث. */
export const effectiveNotifications = (planType: PlanType, notifications: number): number => {
  const n = Math.max(0, Math.round(notifications || 0));
  return planType === "taahud" ? Math.max(0, n - 2) : n;
};

/** قسم من 15 درجة يُخصم منه 3 لكل خطأ/لحن ودرجة لكل تنبيه محتسب. */
export const sectionScore = (
  planType: PlanType,
  notifications: number,
  mistakes: number
): number => {
  const n = effectiveNotifications(planType, notifications);
  const m = Math.max(0, Math.round(mistakes || 0));
  return round1(clamp(15 - n * NOTIFICATION_PENALTY - m * MISTAKE_PENALTY, 0, 15));
};

export const calcNewScore = (r: DailyRecordInput): number =>
  sectionScore(r.plan_type, r.new_notifications, r.new_mistakes_lahn);

export const calcLinkScore = (r: DailyRecordInput): number =>
  sectionScore(r.plan_type, r.link_notifications, r.link_mistakes_lahn);

// ---------------------------------------------------------------- المسارات

export const PLAN_TRACKS: Record<PlanType, string[]> = {
  hifz: ["حفظ وجه", "حفظ وجهين"],
  taahud: ["إتقان وجهين", "إتقان 3 أوجه", "إتقان 4 أوجه", "إتقان 5 أوجه", "إتقان 6 أوجه"],
};

/** متطلبات المسار: عدد مرات التكرار وعدد مرات الاستماع لكل وجه. */
export interface TrackRequirement {
  repetitions: number;
  listening: number;
}

const HIFZ_REQ: Record<string, TrackRequirement> = {
  "حفظ وجه": { repetitions: 25, listening: 3 },
  "حفظ وجهين": { repetitions: 25, listening: 3 },
};

const TAAHUD_REQ: Record<string, TrackRequirement> = {
  "إتقان وجهين": { repetitions: 15, listening: 1 },
  "إتقان 3 أوجه": { repetitions: 10, listening: 1 },
  "إتقان 4 أوجه": { repetitions: 10, listening: 1 },
  "إتقان 5 أوجه": { repetitions: 7, listening: 1 },
  "إتقان 6 أوجه": { repetitions: 7, listening: 1 },
};

export const trackRequirement = (
  planType: PlanType,
  track?: string | null
): TrackRequirement => {
  const table = planType === "hifz" ? HIFZ_REQ : TAAHUD_REQ;
  const fallback: TrackRequirement =
    planType === "hifz" ? { repetitions: 25, listening: 3 } : { repetitions: 10, listening: 1 };
  return (track && table[track]) || fallback;
};

// ---------------------------------------------------------------- الدرجات الفرعية

/** التكرار = 5 درجات كاملة عند بلوغ العدد المطلوب، وإلا نسبةً منه. */
export const calcRepetitionScore = (r: DailyRecordInput): number => {
  const req = trackRequirement(r.plan_type, r.plan_track).repetitions;
  const done = Math.max(0, Number(r.repetitions_count) || 0);
  if (req <= 0) return 0;
  return round1(clamp((done / req) * 5, 0, 5));
};

/** الاستماع = 5 درجات (بطاقة الحفظ فقط) عند بلوغ عدد مرات الاستماع المطلوبة. */
export const calcListeningScore = (r: DailyRecordInput): number => {
  if (r.plan_type !== "hifz") return 0;
  const req = trackRequirement(r.plan_type, r.plan_track).listening;
  const done = Math.max(0, Number(r.listening_count) || 0);
  if (req <= 0) return 0;
  return round1(clamp((done / req) * 5, 0, 5));
};

/** الربط على زميل = 5 درجات (دورة التعاهد فقط). */
export const calcPeerLinkScore = (r: DailyRecordInput): number =>
  r.plan_type === "taahud" ? round1(clamp(Number(r.link_peer_score) || 0, 0, 5)) : 0;

/** مجموع البطاقة من 40 درجة. */
export const calcTotalScore = (r: DailyRecordInput): number => {
  const tail =
    r.plan_type === "hifz" ? calcListeningScore(r) : calcPeerLinkScore(r);
  return round1(
    clamp(calcNewScore(r) + calcLinkScore(r) + calcRepetitionScore(r) + tail, 0, 40)
  );
};

// ---------------------------------------------------------------- النجاح والرسوب

export interface SectionOutcome {
  passed: boolean;
  reason: string | null;
}

/**
 * المقدار الجديد:
 *  - الحفظ : يتوقف ويعيد عند الخطأ/اللحن الثاني، أو خطأ + ثلاث تنبيهات، أو التنبيه السادس.
 *  - التعاهد: يرسب عند الخطأ/اللحن الثالث أو ما يعادله من تنبيهات (تنبيه محتسب من الثالث).
 */
export const evaluateNewPortion = (
  planType: PlanType,
  notifications: number,
  mistakes: number
): SectionOutcome => {
  const m = Math.max(0, Math.round(mistakes || 0));
  const n = effectiveNotifications(planType, notifications);

  if (planType === "hifz") {
    if (m >= 2) return { passed: false, reason: "بلغ الخطأ/اللحن الثاني — يعيد الحفظ" };
    if (m >= 1 && n >= 3) return { passed: false, reason: "خطأ مع ثلاث تنبيهات — يعيد الحفظ" };
    if (n >= 6) return { passed: false, reason: "بلغ التنبيه السادس — يعيد الحفظ" };
    return { passed: true, reason: null };
  }

  const weight = m + n / NOTIFICATIONS_PER_MISTAKE;
  if (weight >= 3) return { passed: false, reason: "بلغ الخطأ/اللحن الثالث أو ما يعادله — راسب في المقدار" };
  return { passed: true, reason: null };
};

/** الربط: راسب عند الخطأ/اللحن الرابع أو ما يعادله من تنبيهات (في البطاقتين). */
export const evaluateLink = (
  planType: PlanType,
  notifications: number,
  mistakes: number
): SectionOutcome => {
  const m = Math.max(0, Math.round(mistakes || 0));
  const n = effectiveNotifications(planType, notifications);
  const weight = m + n / NOTIFICATIONS_PER_MISTAKE;
  if (weight >= 4) return { passed: false, reason: "بلغ الخطأ/اللحن الرابع أو ما يعادله — راسب في الربط" };
  return { passed: true, reason: null };
};

/** خطة المعالجة عند إخفاق المقدار الجديد، كما في آلية كل بطاقة. */
export const remedialPlan = (planType: PlanType): string =>
  planType === "hifz"
    ? "يعيد التكرار خمس مرات تلاوة وخمس مرات حفظاً ثم يسمع على المقرئ"
    : "يعيد التكرار مرة تلاوة ومرتين حفظاً ثم يسمع على المقرئ";

/** هل زمن قراءة الحزب مقبول (لا يقل عن 12 دقيقة). */
export const isHizbTimeValid = (minutes: number | null | undefined): boolean =>
  minutes == null ? true : Number(minutes) >= MIN_HIZB_MINUTES;

// ---------------------------------------------------------------- توزيع الخطة

// Standard Madinah mushaf: 1 juz = 20 wajh (pages/faces).
export const WAJH_PER_JUZ = 20;

export const juzToPages = (juz: number, extraPages = 0): number =>
  Math.max(0, Math.round(juz * WAJH_PER_JUZ + extraPages));

/** Pages for an inclusive juz range using the Madinah mushaf: (to - from + 1) * 20. */
export const juzRangeToPages = (juzFrom: number, juzTo: number): number => {
  const f = Math.max(1, Math.min(30, Math.round(juzFrom || 0)));
  const t = Math.max(1, Math.min(30, Math.round(juzTo || 0)));
  if (!juzFrom || !juzTo || t < f) return 0;
  return (t - f + 1) * WAJH_PER_JUZ;
};

export interface HolidayRange { start_date: string; end_date: string; }

/** Weekend rule: Friday (getDay=5) and Saturday (getDay=6) are non-working. */
export const isWeekend = (d: Date): boolean => {
  const g = d.getDay();
  return g === 5 || g === 6;
};

/** Is date inside any of the holiday ranges (inclusive). */
export const isHoliday = (d: Date, holidays: HolidayRange[]): boolean => {
  const key = d.toISOString().slice(0, 10);
  return holidays.some(h => key >= h.start_date && key <= h.end_date);
};

/** Working day = not Fri/Sat AND not in holidays list. */
export const isWorkingDay = (d: Date, holidays: HolidayRange[] = []): boolean =>
  !isWeekend(d) && !isHoliday(d, holidays);

/** Count working days between start and end (inclusive). */
export const computeWorkingDays = (
  start: string | null,
  end: string | null,
  holidays: HolidayRange[] = []
): number => {
  if (!start || !end) return 0;
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) return 0;
  let count = 0;
  const cur = new Date(s);
  while (cur <= e) {
    if (isWorkingDay(cur, holidays)) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
};

/**
 * Daily wajh across working days only: whole pages, rounded UP, clamped 1..20.
 * Rounding up means the plan may complete before the predetermined end date
 * (the schedule then spans fewer days than the available working days).
 */
export const computeDailyPagesWorking = (
  pagesTarget: number,
  workingDays: number
): number => {
  if (!pagesTarget || workingDays <= 0) return 0;
  return Math.max(1, Math.min(20, Math.ceil(pagesTarget / workingDays)));
};

/** Working days actually needed at the given whole daily rate. */
export const planDaysNeeded = (pagesTarget: number, dailyPages: number): number =>
  pagesTarget > 0 && dailyPages > 0 ? Math.ceil(pagesTarget / dailyPages) : 0;

export const planDurationDays = (start: string | null, end: string | null): number => {
  if (!start || !end) return 0;
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime()) || e < s) return 0;
  return Math.floor((e.getTime() - s.getTime()) / 86400000) + 1;
};
