// Single source of truth for student attendance statuses.
//
// The `attendance_status` enum lives in Postgres; every screen used to keep its own
// private label map, so when `late_excused` ("متأخر بإذن") was added to the enum only
// the main attendance page learned about it — reports, the guardian view and the
// student portal rendered it blank. Deriving the keys from the generated enum type
// means TypeScript now fails the build if a new status is added without a label.

import type { Database } from "@/integrations/supabase/types";

export type AttendanceStatus = Database["public"]["Enums"]["attendance_status"];

export interface AttendanceStatusMeta {
  /** Arabic label shown to users. */
  label: string;
  /** Single glyph for dense report grids. */
  symbol: string;
  /** shadcn Badge variant. */
  badge: "default" | "secondary" | "destructive" | "outline";
  /** Tailwind classes for a coloured cell/chip (light + dark). */
  cellClass: string;
  /** Solid colour, for legend dots and charts. */
  dotClass: string;
  /** Whether the student was physically in the circle — drives attendance rates. */
  countsAsAttended: boolean;
}

export const ATTENDANCE_STATUS: Record<AttendanceStatus, AttendanceStatusMeta> = {
  present: {
    label: "حاضر",
    symbol: "✓",
    badge: "default",
    cellClass: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300",
    dotClass: "bg-emerald-500",
    countsAsAttended: true,
  },
  late: {
    label: "متأخر",
    symbol: "⏰",
    badge: "secondary",
    cellClass: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
    dotClass: "bg-amber-500",
    countsAsAttended: true,
  },
  late_excused: {
    label: "متأخر بإذن",
    symbol: "⏱",
    badge: "secondary",
    cellClass: "bg-purple-100 dark:bg-purple-950/30 text-purple-800 dark:text-purple-300",
    dotClass: "bg-purple-500",
    countsAsAttended: true,
  },
  excused: {
    label: "مستأذن",
    symbol: "≡",
    badge: "outline",
    cellClass: "bg-blue-100 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300",
    dotClass: "bg-blue-500",
    // An approved excuse means the student was not present. It is not counted as
    // attendance, but callers should exclude it from the expected-days denominator.
    countsAsAttended: false,
  },
  absent: {
    label: "غائب",
    symbol: "✗",
    badge: "destructive",
    cellClass: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
    dotClass: "bg-red-500",
    countsAsAttended: false,
  },
};

/** Display order used by pickers, legends and summary rows. */
export const ATTENDANCE_STATUS_ORDER: AttendanceStatus[] = [
  "present",
  "late",
  "late_excused",
  "excused",
  "absent",
];

/** Label for a status that may arrive as a plain string (e.g. from an untyped query). */
export const statusLabel = (status: string | null | undefined): string =>
  (status && ATTENDANCE_STATUS[status as AttendanceStatus]?.label) || status || "—";

export const statusMeta = (status: string | null | undefined): AttendanceStatusMeta | undefined =>
  status ? ATTENDANCE_STATUS[status as AttendanceStatus] : undefined;

export const isAttended = (status: string | null | undefined): boolean =>
  !!statusMeta(status)?.countsAsAttended;

/**
 * Attendance percentage. `late` and `late_excused` count as attended — the student
 * was there. `excused` days are removed from the denominator: an approved absence
 * should not be held against the student.
 */
export const attendanceRate = (
  records: { status: string | null | undefined }[],
  expectedDays: number,
): number => {
  const excusedDays = records.filter((r) => r.status === "excused").length;
  const denominator = Math.max(0, expectedDays - excusedDays);
  if (denominator <= 0) return 0;
  const attended = records.filter((r) => isAttended(r.status)).length;
  return Math.round((attended / denominator) * 100);
};

/** Counts per status, with every key present (zero-filled). */
export const countByStatus = (
  records: { status: string | null | undefined }[],
): Record<AttendanceStatus, number> => {
  const counts = Object.fromEntries(
    ATTENDANCE_STATUS_ORDER.map((s) => [s, 0]),
  ) as Record<AttendanceStatus, number>;
  for (const r of records) {
    const key = r.status as AttendanceStatus;
    if (key in counts) counts[key] += 1;
  }
  return counts;
};
