// Shared logic for the "البرامج التربوية" module.
//
// Weeks in the academy start on Sunday (the academic week is Sun–Thu), so a
// "week" is identified by the ISO date of its Sunday. Keeping that in one place
// means the teacher entry screen, the supervisor board, the reports and the
// leaderboard all agree on which records belong to the same week.

export const WEEKDAY_LABELS = [
  "الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت",
];

export type AttendanceValue = "present" | "absent" | "excused";

export const ATTENDANCE_LABELS: Record<AttendanceValue, string> = {
  present: "حاضر",
  absent: "غائب",
  excused: "معتذر",
};

export interface WeeklyRecord {
  session_attendance?: string | null;
  reading_pages?: number | null;
  reading_done?: boolean | null;
  listening_minutes?: number | null;
  listening_done?: boolean | null;
  memorization_amount?: string | null;
  memorization_done?: boolean | null;
}

/** ISO date (yyyy-mm-dd) of the Sunday that starts the week containing `date`. */
export function weekStart(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date + "T00:00:00") : new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay()); // getDay(): 0 = Sunday
  return toIso(d);
}

/** Shift a week start by `weeks` (negative goes back in time). */
export function shiftWeek(weekStartIso: string, weeks: number): string {
  const d = new Date(weekStartIso + "T00:00:00");
  d.setDate(d.getDate() + weeks * 7);
  return toIso(d);
}

/** Inclusive last day (Saturday) of the week starting at `weekStartIso`. */
export function weekEnd(weekStartIso: string): string {
  return shiftDays(weekStartIso, 6);
}

export function shiftDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return toIso(d);
}

function toIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** The four Sundays (as week starts) making up the month containing `date`, plus any partial ones. */
export function weeksInRange(fromIso: string, toIsoDate: string): string[] {
  const out: string[] = [];
  let cur = weekStart(fromIso);
  const end = weekStart(toIsoDate);
  let guard = 0;
  while (cur <= end && guard < 200) {
    out.push(cur);
    cur = shiftWeek(cur, 1);
    guard++;
  }
  return out;
}

/** A weekly record counts as "entered" once the teacher chose an attendance value. */
export function isRecordEntered(r: WeeklyRecord | null | undefined): boolean {
  return !!r && !!r.session_attendance;
}

/**
 * Commitment for one weekly record: attendance + the three activities, each worth
 * an equal share. Attendance counts fully when present, half when excused.
 */
export function recordCommitment(r: WeeklyRecord | null | undefined): number {
  if (!r) return 0;
  let score = 0;
  if (r.session_attendance === "present") score += 1;
  else if (r.session_attendance === "excused") score += 0.5;
  if (r.reading_done) score += 1;
  if (r.listening_done) score += 1;
  if (r.memorization_done) score += 1;
  return Math.round((score / 4) * 100);
}

/** Average commitment across many weekly records (0 when there are none). */
export function averageCommitment(records: WeeklyRecord[]): number {
  if (!records.length) return 0;
  const sum = records.reduce((s, r) => s + recordCommitment(r), 0);
  return Math.round(sum / records.length);
}

export interface AxisTotals {
  attendance: number;   // number of attended sessions
  reading: number;      // pages read
  listening: number;    // minutes listened
  memorization: number; // completed memorization weeks
}

export function sumAxes(records: WeeklyRecord[]): AxisTotals {
  return records.reduce<AxisTotals>(
    (acc, r) => ({
      attendance: acc.attendance + (r.session_attendance === "present" ? 1 : 0),
      reading: acc.reading + (Number(r.reading_pages) || 0),
      listening: acc.listening + (Number(r.listening_minutes) || 0),
      memorization: acc.memorization + (r.memorization_done ? 1 : 0),
    }),
    { attendance: 0, reading: 0, listening: 0, memorization: 0 },
  );
}

export type LeaderboardAxis = keyof AxisTotals | "overall";

export interface LeaderboardEntry {
  student_id: string;
  student_name: string;
  halaqa_name?: string;
  totals: AxisTotals;
  commitment: number;
}

/**
 * Rank entries for one axis. `overall` uses commitment, which already blends the
 * four axes, so a student who does everything modestly outranks a one-axis spike.
 */
export function rankBy(entries: LeaderboardEntry[], axis: LeaderboardAxis, limit = 10): LeaderboardEntry[] {
  const value = (e: LeaderboardEntry) => (axis === "overall" ? e.commitment : e.totals[axis]);
  return [...entries]
    .filter((e) => value(e) > 0)
    .sort((a, b) => value(b) - value(a) || b.commitment - a.commitment)
    .slice(0, limit);
}

/** Grade band for a percentage, used by exams and the periodic reports. */
export function gradeLabel(percentage: number): string {
  if (percentage >= 90) return "ممتاز";
  if (percentage >= 80) return "جيد جداً";
  if (percentage >= 70) return "جيد";
  if (percentage >= 60) return "مقبول";
  return "يحتاج متابعة";
}

export function scorePercentage(score: number | null | undefined, maxScore: number | null | undefined): number {
  const max = Number(maxScore);
  if (!max || max <= 0) return 0;
  const s = Number(score);
  if (!Number.isFinite(s) || s < 0) return 0;
  return Math.round(Math.min((s / max) * 100, 100));
}

/** Percentage of survey answers, per question, on the 1–5 scale. */
export function scaleAverage(values: number[]): number {
  const nums = values.filter((v) => Number.isFinite(v));
  if (!nums.length) return 0;
  return Math.round((nums.reduce((s, v) => s + v, 0) / nums.length) * 10) / 10;
}

export const PROGRAM_STATUS_LABELS: Record<string, string> = {
  draft: "مسوّدة",
  active: "نشط",
  finished: "منتهٍ",
};

export const EXAM_TYPE_LABELS: Record<string, string> = {
  monthly: "شهري",
  quarterly: "فصلي",
  program: "برنامج",
};

export const EVENT_TYPE_LABELS: Record<string, string> = {
  program: "برنامج تربوي",
  review: "مراجعة",
  contest: "مسابقة",
  exam: "اختبار",
};
