import { describe, it, expect } from "vitest";
import {
  weekStart, weekEnd, shiftWeek, weeksInRange, isRecordEntered,
  recordCommitment, averageCommitment, sumAxes, rankBy, gradeLabel,
  scorePercentage, scaleAverage, type LeaderboardEntry,
} from "./tarbawi";

describe("week helpers", () => {
  it("snaps any day to the Sunday that starts its week", () => {
    // 2026-08-15 is a Saturday → same week as Sunday 2026-08-09
    expect(weekStart("2026-08-15")).toBe("2026-08-09");
    expect(weekStart("2026-08-09")).toBe("2026-08-09");
    expect(weekStart("2026-08-12")).toBe("2026-08-09");
  });

  it("ends the week on Saturday", () => {
    expect(weekEnd("2026-08-09")).toBe("2026-08-15");
  });

  it("shifts weeks in both directions", () => {
    expect(shiftWeek("2026-08-09", -1)).toBe("2026-08-02");
    expect(shiftWeek("2026-08-09", 2)).toBe("2026-08-23");
  });

  it("lists every week start in a range", () => {
    expect(weeksInRange("2026-08-01", "2026-08-31")).toEqual([
      "2026-07-26", "2026-08-02", "2026-08-09", "2026-08-16", "2026-08-23", "2026-08-30",
    ]);
  });
});

describe("commitment", () => {
  it("treats a missing attendance value as not entered", () => {
    expect(isRecordEntered(null)).toBe(false);
    expect(isRecordEntered({ reading_pages: 3 })).toBe(false);
    expect(isRecordEntered({ session_attendance: "absent" })).toBe(true);
  });

  it("gives 100% when everything is done", () => {
    expect(recordCommitment({
      session_attendance: "present", reading_done: true,
      listening_done: true, memorization_done: true,
    })).toBe(100);
  });

  it("counts an excused session as half attendance", () => {
    expect(recordCommitment({ session_attendance: "excused" })).toBe(13); // 0.5/4
    expect(recordCommitment({ session_attendance: "present" })).toBe(25);
    expect(recordCommitment({ session_attendance: "absent" })).toBe(0);
  });

  it("averages across weeks and handles the empty case", () => {
    expect(averageCommitment([])).toBe(0);
    expect(averageCommitment([
      { session_attendance: "present", reading_done: true, listening_done: true, memorization_done: true },
      { session_attendance: "absent" },
    ])).toBe(50);
  });
});

describe("axes and ranking", () => {
  const records = [
    { session_attendance: "present", reading_pages: 5, listening_minutes: 20, memorization_done: true },
    { session_attendance: "absent", reading_pages: 2, listening_minutes: null, memorization_done: false },
  ];

  it("sums the four axes ignoring null values", () => {
    expect(sumAxes(records)).toEqual({ attendance: 1, reading: 7, listening: 20, memorization: 1 });
  });

  const entries: LeaderboardEntry[] = [
    { student_id: "a", student_name: "أ", totals: { attendance: 4, reading: 10, listening: 30, memorization: 2 }, commitment: 80 },
    { student_id: "b", student_name: "ب", totals: { attendance: 2, reading: 40, listening: 5, memorization: 0 }, commitment: 45 },
    { student_id: "c", student_name: "ج", totals: { attendance: 0, reading: 0, listening: 0, memorization: 0 }, commitment: 0 },
  ];

  it("ranks per axis and drops zero-activity students", () => {
    expect(rankBy(entries, "reading").map((e) => e.student_id)).toEqual(["b", "a"]);
    expect(rankBy(entries, "attendance").map((e) => e.student_id)).toEqual(["a", "b"]);
    expect(rankBy(entries, "overall").map((e) => e.student_id)).toEqual(["a", "b"]);
  });

  it("respects the limit", () => {
    expect(rankBy(entries, "overall", 1).map((e) => e.student_id)).toEqual(["a"]);
  });
});

describe("grades", () => {
  it("maps percentages to bands", () => {
    expect(gradeLabel(95)).toBe("ممتاز");
    expect(gradeLabel(85)).toBe("جيد جداً");
    expect(gradeLabel(72)).toBe("جيد");
    expect(gradeLabel(61)).toBe("مقبول");
    expect(gradeLabel(40)).toBe("يحتاج متابعة");
  });

  it("computes safe percentages", () => {
    expect(scorePercentage(45, 50)).toBe(90);
    expect(scorePercentage(60, 50)).toBe(100); // never above 100
    expect(scorePercentage(10, 0)).toBe(0);
    expect(scorePercentage(null, 50)).toBe(0);
    expect(scorePercentage(-5, 50)).toBe(0);
  });

  it("averages survey scale answers to one decimal", () => {
    expect(scaleAverage([5, 4, 4])).toBe(4.3);
    expect(scaleAverage([])).toBe(0);
    expect(scaleAverage([NaN, 5])).toBe(5);
  });
});
