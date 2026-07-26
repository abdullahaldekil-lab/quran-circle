import { describe, it, expect } from "vitest";
import {
  DEFAULT_WINDOW,
  autoStatusForMark,
  resolveAutoStage,
  resolveWindow,
  teacherWindowStatus,
} from "./attendanceWindow";

const w = resolveWindow(null);

describe("resolveWindow", () => {
  it("falls back to the shipped defaults when nothing is configured", () => {
    expect(w).toEqual({
      tardinessMinutes: DEFAULT_WINDOW.tardinessMinutes,
      absentMinutes: DEFAULT_WINDOW.absentMinutes,
      windowCloseMinutes: DEFAULT_WINDOW.windowCloseMinutes,
    });
  });

  it("uses configured values", () => {
    expect(
      resolveWindow({ tardiness_minutes: 45, absent_minutes: 90, teacher_window_close_minutes: 120 }),
    ).toEqual({ tardinessMinutes: 45, absentMinutes: 90, windowCloseMinutes: 120 });
  });

  it("never lets absence come before lateness", () => {
    const r = resolveWindow({ tardiness_minutes: 80, absent_minutes: 30 });
    expect(r.absentMinutes).toBe(80);
  });

  it("never closes the window before the absence cut-off", () => {
    const r = resolveWindow({ tardiness_minutes: 70, absent_minutes: 100, teacher_window_close_minutes: 60 });
    expect(r.windowCloseMinutes).toBe(100);
  });

  it("ignores null, negative and non-numeric values", () => {
    expect(resolveWindow({ tardiness_minutes: null, absent_minutes: -5 })).toEqual({
      tardinessMinutes: 70,
      absentMinutes: 100,
      windowCloseMinutes: 105,
    });
  });

  it("accepts zero as a deliberate configuration", () => {
    expect(resolveWindow({ tardiness_minutes: 0 }).tardinessMinutes).toBe(0);
  });
});

describe("resolveAutoStage", () => {
  it("does nothing before the late threshold", () => {
    expect(resolveAutoStage(0, w)).toBe("too_early");
    expect(resolveAutoStage(69, w)).toBe("too_early");
  });

  it("marks late exactly at the threshold", () => {
    expect(resolveAutoStage(70, w)).toBe("late");
    expect(resolveAutoStage(99, w)).toBe("late");
  });

  it("marks absent exactly at the absence threshold and beyond", () => {
    expect(resolveAutoStage(100, w)).toBe("absent");
    expect(resolveAutoStage(240, w)).toBe("absent");
  });

  it("handles a negative elapsed time (before the prayer)", () => {
    expect(resolveAutoStage(-30, w)).toBe("too_early");
  });
});

describe("teacherWindowStatus", () => {
  it("is closed before the base prayer", () => {
    expect(teacherWindowStatus(-1, w)).toBe("before_open");
  });

  it("opens at the base prayer and stays open to the cut-off", () => {
    expect(teacherWindowStatus(0, w)).toBe("open");
    expect(teacherWindowStatus(104, w)).toBe("open");
  });

  it("closes at the cut-off", () => {
    expect(teacherWindowStatus(105, w)).toBe("closed");
    expect(teacherWindowStatus(500, w)).toBe("closed");
  });
});

describe("autoStatusForMark", () => {
  it("is present before the late threshold and late from it onwards", () => {
    expect(autoStatusForMark(69, w)).toBe("present");
    expect(autoStatusForMark(70, w)).toBe("late");
    expect(autoStatusForMark(101, w)).toBe("late");
  });
});
