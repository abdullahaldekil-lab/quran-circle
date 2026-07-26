import { describe, it, expect } from "vitest";
import {
  ATTENDANCE_STATUS,
  ATTENDANCE_STATUS_ORDER,
  attendanceRate,
  countByStatus,
  isAttended,
  statusLabel,
  statusMeta,
  type AttendanceStatus,
} from "./attendanceStatus";

const rows = (...statuses: string[]) => statuses.map((status) => ({ status }));

describe("ATTENDANCE_STATUS coverage", () => {
  it("labels every status in the DB enum, including late_excused", () => {
    // The keys come from Database["public"]["Enums"]["attendance_status"], so this
    // failing means the enum grew a value with no label — the exact bug this fixes.
    for (const key of Object.keys(ATTENDANCE_STATUS) as AttendanceStatus[]) {
      expect(ATTENDANCE_STATUS[key].label.trim()).not.toBe("");
      expect(ATTENDANCE_STATUS[key].symbol.trim()).not.toBe("");
    }
    expect(ATTENDANCE_STATUS.late_excused.label).toBe("متأخر بإذن");
  });

  it("orders every status exactly once", () => {
    const keys = Object.keys(ATTENDANCE_STATUS).sort();
    expect([...ATTENDANCE_STATUS_ORDER].sort()).toEqual(keys);
    expect(new Set(ATTENDANCE_STATUS_ORDER).size).toBe(ATTENDANCE_STATUS_ORDER.length);
  });
});

describe("statusLabel", () => {
  it("translates known statuses", () => {
    expect(statusLabel("late_excused")).toBe("متأخر بإذن");
    expect(statusLabel("excused")).toBe("مستأذن");
  });

  it("falls back to the raw value for unknown input and a dash for empty", () => {
    expect(statusLabel("something_else")).toBe("something_else");
    expect(statusLabel(null)).toBe("—");
    expect(statusLabel(undefined)).toBe("—");
  });

  it("returns undefined metadata for unknown statuses", () => {
    expect(statusMeta("nope")).toBeUndefined();
    expect(statusMeta(null)).toBeUndefined();
  });
});

describe("isAttended", () => {
  it("counts present, late and late_excused as attended", () => {
    expect(isAttended("present")).toBe(true);
    expect(isAttended("late")).toBe(true);
    expect(isAttended("late_excused")).toBe(true);
  });

  it("does not count excused or absent as attended", () => {
    expect(isAttended("excused")).toBe(false);
    expect(isAttended("absent")).toBe(false);
    expect(isAttended(null)).toBe(false);
  });
});

describe("attendanceRate", () => {
  it("counts a late-with-permission day as attendance", () => {
    expect(attendanceRate(rows("present", "late_excused"), 2)).toBe(100);
  });

  it("excludes excused days from the denominator rather than penalising them", () => {
    // 3 expected days, 1 excused → denominator 2, attended 2 → 100%
    expect(attendanceRate(rows("present", "late", "excused"), 3)).toBe(100);
  });

  it("penalises absence", () => {
    expect(attendanceRate(rows("present", "absent"), 2)).toBe(50);
  });

  it("returns 0 rather than NaN or Infinity when nothing is expected", () => {
    expect(attendanceRate([], 0)).toBe(0);
    expect(attendanceRate(rows("excused"), 1)).toBe(0);
  });

  it("never divides by a negative denominator", () => {
    expect(attendanceRate(rows("excused", "excused", "excused"), 1)).toBe(0);
  });
});

describe("countByStatus", () => {
  it("zero-fills every status key", () => {
    const counts = countByStatus(rows("present", "present", "late_excused"));
    expect(counts.present).toBe(2);
    expect(counts.late_excused).toBe(1);
    expect(counts.absent).toBe(0);
    expect(counts.excused).toBe(0);
    expect(counts.late).toBe(0);
  });

  it("ignores values that are not real statuses", () => {
    const counts = countByStatus(rows("present", "bogus"));
    expect(counts.present).toBe(1);
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(1);
  });
});
