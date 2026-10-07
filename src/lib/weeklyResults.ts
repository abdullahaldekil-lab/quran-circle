// Weekly (Sun–Thu) results for a student's track: attendance, recitation, homework.

export const toISO = (d: Date) => {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

/** Returns Sunday..Thursday range containing `date`, shifted by `offset` weeks. */
export const weekRange = (date: Date, offset = 0) => {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - d.getDay() + offset * 7);
  const end = new Date(d);
  end.setDate(d.getDate() + 4);
  return { from: toISO(d), to: toISO(end) };
};

export interface WeekInput {
  attendance: { status: string }[];
  recitations: { total_score: number | null }[];
  homework: { homework_status: string | null }[];
}

export interface WeekSummary {
  present: number; absent: number; late: number; excused: number;
  attendancePct: number; recitationAvg: number; homeworkPct: number; total: number;
}

const PRESENT = new Set(["present", "late", "late_excused"]);

export const summarizeWeek = ({ attendance, recitations, homework }: WeekInput): WeekSummary => {
  const present = attendance.filter((a) => a.status === "present").length;
  const late = attendance.filter((a) => a.status === "late" || a.status === "late_excused").length;
  const absent = attendance.filter((a) => a.status === "absent").length;
  const excused = attendance.filter((a) => a.status === "excused").length;
  const counted = attendance.filter((a) => a.status !== "excused").length;
  const attendancePct = counted ? Math.round((attendance.filter((a) => PRESENT.has(a.status)).length / counted) * 100) : 0;
  const scores = recitations.map((r) => Number(r.total_score)).filter((n) => !isNaN(n) && n > 0);
  const recitationAvg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const hw = homework.filter((h) => h.homework_status);
  const homeworkPct = hw.length ? Math.round((hw.filter((h) => h.homework_status === "submitted" || h.homework_status === "done").length / hw.length) * 100) : 0;
  const parts = [attendancePct, ...(scores.length ? [recitationAvg] : []), ...(hw.length ? [homeworkPct] : [])];
  const total = Math.round(parts.reduce((a, b) => a + b, 0) / parts.length);
  return { present, absent, late, excused, attendancePct, recitationAvg, homeworkPct, total };
};

/** Dense ranking by total desc; ties share a rank. */
export const rankByTotal = <T extends { total: number }>(rows: T[]): (T & { rank: number })[] => {
  const sorted = [...rows].sort((a, b) => b.total - a.total);
  let rank = 0, prev: number | null = null;
  return sorted.map((r) => {
    if (r.total !== prev) { rank++; prev = r.total; }
    return { ...r, rank };
  });
};
