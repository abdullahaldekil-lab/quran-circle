import { describe, it, expect } from "vitest";
import { weekRange, summarizeWeek, rankByTotal } from "./weeklyResults";

describe("weeklyResults", () => {
  it("week range is Sunday to Thursday", () => {
    expect(weekRange(new Date(2026, 9, 7))).toEqual({ from: "2026-10-04", to: "2026-10-08" });
    expect(weekRange(new Date(2026, 9, 7), -1)).toEqual({ from: "2026-09-27", to: "2026-10-01" });
  });
  it("summarizes a week", () => {
    const s = summarizeWeek({
      attendance: [{ status: "present" }, { status: "absent" }, { status: "excused" }, { status: "late" }],
      recitations: [{ total_score: 80 }, { total_score: 100 }],
      homework: [{ homework_status: "submitted" }, { homework_status: "not_submitted" }],
    });
    expect(s.attendancePct).toBe(67);
    expect(s.recitationAvg).toBe(90);
    expect(s.homeworkPct).toBe(50);
    expect(s.total).toBe(69);
  });
  it("ranks with ties", () => {
    const r = rankByTotal([{ total: 50 }, { total: 90 }, { total: 90 }]);
    expect(r.map((x) => x.rank)).toEqual([1, 1, 2]);
  });
});
