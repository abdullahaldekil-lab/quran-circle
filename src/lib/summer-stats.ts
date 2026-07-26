// Statistics for the summer (educational) programme.
//
// The stats tab used to show totals, a per-maqra table and a raw student *count* per
// source halaqa. What was missing: a daily view, a weekly view, individual student
// percentages, and percentages (rather than counts) for maqare and halaqat.
//
// All pure — the page passes in what it loaded and renders what comes back.

import { computeWorkingDays, isWorkingDay, type HolidayRange } from "./summer-scoring";

export interface StatStudent {
  id: string;
  student_id?: string | null;
  maqra_id?: string | null;
  source_halaqa_id?: string | null;
  plan_type?: string | null;
  pages_target?: number | null;
  plan_start_date?: string | null;
  plan_end_date?: string | null;
}

export interface StatRecord {
  summer_student_id: string;
  record_date: string;
  link_pages_count?: number | null;
  total_score?: number | null;
}

export interface StatAttendance {
  summer_student_id: string;
  attendance_date: string;
  status: string;
}

export interface StatMaqra {
  id: string;
  name: string;
  plan_category?: string | null;
}

export interface StatHalaqa {
  id: string;
  name: string;
}

/** Statuses that mean the student showed up. Mirrors the attendance module's rule. */
const ATTENDED = new Set(["present", "late", "late_excused"]);
const EXCUSED = new Set(["excused"]);

const pct = (part: number, whole: number): number =>
  whole > 0 ? Math.min(100, Math.round((part / whole) * 100)) : 0;

const avg = (values: number[]): number =>
  values.length ? Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10 : 0;

export interface PerStudentStat {
  student: StatStudent;
  target: number;
  covered: number;
  progressPct: number;
  avgScore: number;
  daysRecorded: number;
  attendedDays: number;
  expectedDays: number;
  attendancePct: number;
  /** How the student is doing against the plan, same vocabulary as plan progress. */
  status: "ahead" | "on_track" | "behind";
}

/**
 * Per-student figures.
 *
 * `expectedDays` counts working days from the plan start to today (never past the plan
 * end), reusing the same weekend/holiday rules the plan itself was built with — so the
 * attendance percentage is not diluted by days that have not happened yet.
 */
export const perStudentStats = (
  students: StatStudent[],
  records: StatRecord[],
  attendance: StatAttendance[],
  holidays: HolidayRange[] = [],
  todayISO?: string,
): PerStudentStat[] => {
  const today = todayISO || new Date().toISOString().slice(0, 10);

  const recordsByStudent = new Map<string, StatRecord[]>();
  for (const r of records || []) {
    const list = recordsByStudent.get(r.summer_student_id) || [];
    list.push(r);
    recordsByStudent.set(r.summer_student_id, list);
  }

  const attendanceByStudent = new Map<string, StatAttendance[]>();
  for (const a of attendance || []) {
    const list = attendanceByStudent.get(a.summer_student_id) || [];
    list.push(a);
    attendanceByStudent.set(a.summer_student_id, list);
  }

  return (students || []).map((student) => {
    const recs = recordsByStudent.get(student.id) || [];
    const atts = attendanceByStudent.get(student.id) || [];

    const target = Number(student.pages_target) || 0;
    const covered = recs.reduce((s, r) => s + (Number(r.link_pages_count) || 0), 0);
    const progressPct = pct(covered, target);

    const end = student.plan_end_date && student.plan_end_date < today ? student.plan_end_date : today;
    const expectedRaw = computeWorkingDays(student.plan_start_date ?? null, end, holidays);
    // Approved excuses are removed from the denominator rather than counted against.
    const excusedDays = atts.filter((a) => EXCUSED.has(a.status)).length;
    const expectedDays = Math.max(0, expectedRaw - excusedDays);
    const attendedDays = atts.filter((a) => ATTENDED.has(a.status)).length;

    return {
      student,
      target,
      covered,
      progressPct,
      avgScore: avg(recs.map((r) => Number(r.total_score) || 0)),
      daysRecorded: recs.length,
      attendedDays,
      expectedDays,
      attendancePct: pct(attendedDays, expectedDays),
      status: progressPct >= 100 ? "ahead" : progressPct >= 70 ? "on_track" : "behind",
    };
  });
};

const rollUp = (rows: PerStudentStat[]) => {
  const target = rows.reduce((s, r) => s + r.target, 0);
  const covered = rows.reduce((s, r) => s + r.covered, 0);
  const attended = rows.reduce((s, r) => s + r.attendedDays, 0);
  const expected = rows.reduce((s, r) => s + r.expectedDays, 0);
  const scored = rows.filter((r) => r.daysRecorded > 0);
  return {
    students: rows.length,
    target,
    covered,
    progressPct: pct(covered, target),
    attendancePct: pct(attended, expected),
    avgScore: avg(scored.map((r) => r.avgScore)),
    onTrackPct: pct(rows.filter((r) => r.status !== "behind").length, rows.length),
  };
};

export interface GroupStat extends ReturnType<typeof rollUp> {
  id: string;
  name: string;
  category?: string | null;
}

/** Per-maqra roll-up, ordered by progress. */
export const perMaqraStats = (maqare: StatMaqra[], perStudent: PerStudentStat[]): GroupStat[] =>
  (maqare || [])
    .map((m) => ({
      id: m.id,
      name: m.name,
      category: m.plan_category ?? null,
      ...rollUp(perStudent.filter((r) => r.student.maqra_id === m.id)),
    }))
    .sort((a, b) => b.progressPct - a.progressPct || b.students - a.students);

/**
 * Per-source-halaqa roll-up. `halaqaSizes` maps a halaqa id to its total active
 * student count, which turns "how many joined" into "what share of the halaqa joined"
 * — the participation figure the section header always claimed to show.
 */
export const perSourceHalaqaStats = (
  halaqat: StatHalaqa[],
  perStudent: PerStudentStat[],
  halaqaSizes: Record<string, number> = {},
): (GroupStat & { participationPct: number; halaqaSize: number })[] =>
  (halaqat || [])
    .map((h) => {
      const rows = perStudent.filter((r) => r.student.source_halaqa_id === h.id);
      const size = halaqaSizes[h.id] || 0;
      return {
        id: h.id,
        name: h.name,
        ...rollUp(rows),
        halaqaSize: size,
        participationPct: pct(rows.length, size),
      };
    })
    .filter((h) => h.students > 0)
    .sort((a, b) => b.participationPct - a.participationPct || b.students - a.students);

export interface DailySnapshot {
  date: string;
  enrolled: number;
  recorded: number;
  participationPct: number;
  pagesCovered: number;
  avgScore: number;
  attended: number;
  attendanceMarked: number;
  attendancePct: number;
}

/** Figures for a single day across the whole programme. */
export const dailyStats = (
  students: StatStudent[],
  records: StatRecord[],
  attendance: StatAttendance[],
  dateISO: string,
): DailySnapshot => {
  const dayRecords = (records || []).filter((r) => r.record_date === dateISO);
  const dayAttendance = (attendance || []).filter((a) => a.attendance_date === dateISO);
  const attended = dayAttendance.filter((a) => ATTENDED.has(a.status)).length;
  const excused = dayAttendance.filter((a) => EXCUSED.has(a.status)).length;
  const denominator = Math.max(0, dayAttendance.length - excused);

  return {
    date: dateISO,
    enrolled: (students || []).length,
    recorded: dayRecords.length,
    participationPct: pct(dayRecords.length, (students || []).length),
    pagesCovered: dayRecords.reduce((s, r) => s + (Number(r.link_pages_count) || 0), 0),
    avgScore: avg(dayRecords.map((r) => Number(r.total_score) || 0)),
    attended,
    attendanceMarked: dayAttendance.length,
    attendancePct: pct(attended, denominator),
  };
};

export interface WeeklyBucket {
  weekStart: string;
  weekEnd: string;
  label: string;
  workingDays: number;
  pagesCovered: number;
  recorded: number;
  avgScore: number;
  attended: number;
  attendancePct: number;
}

const addDays = (iso: string, days: number): string => {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
};

/** Start of the Saudi week (Sunday) containing the date. */
export const weekStartOf = (dateISO: string): string => {
  const d = new Date(dateISO);
  if (Number.isNaN(d.getTime())) return dateISO;
  return addDays(dateISO, -d.getDay()); // getDay: Sunday = 0
};

/**
 * The last `weeks` Sunday-to-Saturday buckets ending with the week containing
 * `todayISO`, oldest first.
 */
export const weeklyStats = (
  records: StatRecord[],
  attendance: StatAttendance[],
  todayISO: string,
  weeks = 6,
  holidays: HolidayRange[] = [],
): WeeklyBucket[] => {
  const currentStart = weekStartOf(todayISO);
  const buckets: WeeklyBucket[] = [];

  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = addDays(currentStart, -7 * i);
    const weekEnd = addDays(weekStart, 6);

    const inWeek = (d: string) => d >= weekStart && d <= weekEnd;
    const recs = (records || []).filter((r) => inWeek(r.record_date));
    const atts = (attendance || []).filter((a) => inWeek(a.attendance_date));
    const attended = atts.filter((a) => ATTENDED.has(a.status)).length;
    const excused = atts.filter((a) => EXCUSED.has(a.status)).length;

    let workingDays = 0;
    for (let d = 0; d < 7; d++) {
      if (isWorkingDay(new Date(addDays(weekStart, d)), holidays)) workingDays++;
    }

    buckets.push({
      weekStart,
      weekEnd,
      label: `${weekStart.slice(5)} → ${weekEnd.slice(5)}`,
      workingDays,
      pagesCovered: recs.reduce((s, r) => s + (Number(r.link_pages_count) || 0), 0),
      recorded: recs.length,
      avgScore: avg(recs.map((r) => Number(r.total_score) || 0)),
      attended,
      attendancePct: pct(attended, Math.max(0, atts.length - excused)),
    });
  }

  return buckets;
};

export interface ProgrammeStats {
  totalStudents: number;
  hifzStudents: number;
  taahudStudents: number;
  target: number;
  covered: number;
  progressPct: number;
  attendancePct: number;
  avgScore: number;
  onTrackPct: number;
}

/** Whole-programme roll-up. */
export const programmeStats = (perStudent: PerStudentStat[]): ProgrammeStats => {
  const base = rollUp(perStudent);
  return {
    totalStudents: base.students,
    hifzStudents: perStudent.filter((r) => r.student.plan_type === "hifz").length,
    taahudStudents: perStudent.filter((r) => r.student.plan_type === "taahud").length,
    target: base.target,
    covered: base.covered,
    progressPct: base.progressPct,
    attendancePct: base.attendancePct,
    avgScore: base.avgScore,
    onTrackPct: base.onTrackPct,
  };
};
