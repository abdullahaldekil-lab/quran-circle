// The attendance window and the automatic late/absent thresholds.
//
// These used to be hardcoded in src/pages/Attendance.tsx while `preparation_config`
// carried unused `tardiness_minutes` / `absent_minutes` columns, so what the manager
// configured had no effect. Everything now derives from one config object, and the
// same rules drive the scheduled `student-attendance-monitor` function.

/** Fallbacks matching the values the app shipped with. */
export const DEFAULT_WINDOW = {
  /** Minutes after the base prayer at which a student is considered late. */
  tardinessMinutes: 70,
  /** Minutes after the base prayer at which an unmarked student is recorded absent. */
  absentMinutes: 100,
  /** Minutes after the base prayer at which the teacher can no longer record. */
  windowCloseMinutes: 105,
} as const;

export interface WindowConfig {
  tardiness_minutes?: number | null;
  absent_minutes?: number | null;
  teacher_window_close_minutes?: number | null;
}

export interface ResolvedWindow {
  tardinessMinutes: number;
  absentMinutes: number;
  windowCloseMinutes: number;
}

/**
 * Reads the configured thresholds, falling back to the defaults and keeping them
 * ordered: a student cannot be marked absent before being marked late, and the
 * recording window cannot close before the absence cut-off.
 */
export const resolveWindow = (config: WindowConfig | null | undefined): ResolvedWindow => {
  const positive = (v: unknown, fallback: number) =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : fallback;

  const tardinessMinutes = positive(config?.tardiness_minutes, DEFAULT_WINDOW.tardinessMinutes);
  const absentMinutes = Math.max(
    tardinessMinutes,
    positive(config?.absent_minutes, DEFAULT_WINDOW.absentMinutes),
  );
  const windowCloseMinutes = Math.max(
    absentMinutes,
    positive(config?.teacher_window_close_minutes, DEFAULT_WINDOW.windowCloseMinutes),
  );
  return { tardinessMinutes, absentMinutes, windowCloseMinutes };
};

export type AutoStage = "too_early" | "late" | "absent";

/** Which automatic action is due, given how long the circle day has been running. */
export const resolveAutoStage = (minutesSinceStart: number, w: ResolvedWindow): AutoStage => {
  if (minutesSinceStart >= w.absentMinutes) return "absent";
  if (minutesSinceStart >= w.tardinessMinutes) return "late";
  return "too_early";
};

export type TeacherWindowStatus = "before_open" | "open" | "closed";

/** Whether a teacher may record right now. Opens at the base prayer. */
export const teacherWindowStatus = (
  minutesSinceStart: number,
  w: ResolvedWindow,
): TeacherWindowStatus => {
  if (minutesSinceStart < 0) return "before_open";
  if (minutesSinceStart < w.windowCloseMinutes) return "open";
  return "closed";
};

/**
 * Status a student's mark should carry when the teacher taps them right now.
 * Before the late threshold they are on time; after it they are late.
 */
export const autoStatusForMark = (
  minutesSinceStart: number,
  w: ResolvedWindow,
): "present" | "late" => (minutesSinceStart >= w.tardinessMinutes ? "late" : "present");
