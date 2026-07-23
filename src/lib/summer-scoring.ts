// Pure scoring helpers for the summer maqra daily card.
// Two plan types share the same 40-point structure but differ in bonuses.
//   hifz   = new(15) + link(15) + listening(5) + repetitions(5)      = 40
//   taahud = new(15) + link(15) + test(5)      + amyal(5)            = 40

export type PlanType = "hifz" | "taahud";

export interface DailyRecordInput {
  plan_type: PlanType;
  // new portion
  new_notifications: number;
  new_mistakes_lahn: number;
  new_listening_done: boolean;   // hifz only bonus
  new_repetitions_done: boolean; // hifz only bonus
  new_test_score: number;        // taahud only bonus (0..5)
  // linking on reciter
  link_notifications: number;
  link_mistakes_lahn: number;
  // amyal
  amyal_score: number;           // taahud only (0..5)
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

// The "raw" 10-point base within a 15-point section, penalized by
// notifications (0.5 each) and mistakes/lahn (1 each). Then + bonuses = 15.
const sectionBase = (notifications: number, mistakes: number) =>
  clamp(10 - (notifications * 0.5) - mistakes, 0, 10);

export const calcNewScore = (r: DailyRecordInput): number => {
  const base = sectionBase(r.new_notifications, r.new_mistakes_lahn);
  const bonus =
    r.plan_type === "hifz"
      ? (r.new_listening_done ? 2.5 : 0) + (r.new_repetitions_done ? 2.5 : 0)
      : clamp(r.new_test_score, 0, 5);
  return Math.round(clamp(base + bonus, 0, 15) * 10) / 10;
};

export const calcLinkScore = (r: DailyRecordInput): number => {
  // Link section: 15 points, no built-in bonuses beyond the section base
  // (scaled from 10 -> 15 by adding a fixed 5 execution credit when the row
  // is entered — matches the printed card where "المقرئ" filling implies 5).
  const base = sectionBase(r.link_notifications, r.link_mistakes_lahn);
  return Math.round(clamp(base + 5, 0, 15) * 10) / 10;
};

export const calcAmyalScore = (r: DailyRecordInput): number =>
  r.plan_type === "taahud" ? clamp(r.amyal_score, 0, 5) : 0;

// Total is always out of 40:
//   hifz   = new(0..15) + link(0..15) + engagement(10, day completion)
//   taahud = new(0..15) + link(0..15) + link_execution(5) + amyal(0..5)
export const calcTotalScore = (r: DailyRecordInput): number => {
  const n = calcNewScore(r);
  const l = calcLinkScore(r);
  const tail = r.plan_type === "hifz" ? 10 : 5 + clamp(r.amyal_score, 0, 5);
  return Math.round(clamp(n + l + tail, 0, 40) * 10) / 10;
};

export const PLAN_TRACKS: Record<PlanType, string[]> = {
  hifz: ["حفظ وجه", "حفظ وجهين"],
  taahud: ["إتقان وجهين", "إتقان 3 أوجه", "إتقان 4 أوجه", "إتقان 5 أوجه", "إتقان جزء"],
};

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
