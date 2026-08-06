import { describe, it, expect } from "vitest";
import {
  aggregateStats,
  clampNumber,
  completionPercent,
  isCompleted,
  totalStats,
  type MaterialViewRow,
} from "./materialViews";

const row = (over: Partial<MaterialViewRow>): MaterialViewRow => ({
  material_id: "m1",
  event_type: "play",
  seconds_watched: 60,
  completion_percent: 50,
  student_id: null,
  student_code: null,
  viewed_at: "2026-08-06T00:00:00Z",
  ...over,
});

describe("clampNumber", () => {
  it("clamps and rounds", () => {
    expect(clampNumber(12.6, 0, 100)).toBe(13);
    expect(clampNumber(-5, 0, 100)).toBe(0);
    expect(clampNumber(500, 0, 100)).toBe(100);
  });

  it("falls back to the minimum for junk values", () => {
    expect(clampNumber(NaN, 0, 100)).toBe(0);
    expect(clampNumber(Infinity, 0, 100)).toBe(100);
    expect(clampNumber("abc", 0, 100)).toBe(0);
  });
});

describe("completionPercent", () => {
  it("computes a percentage", () => {
    expect(completionPercent(30, 60)).toBe(50);
    expect(completionPercent(60, 60)).toBe(100);
  });

  it("returns zero when the duration is unknown", () => {
    expect(completionPercent(30, 0)).toBe(0);
    expect(completionPercent(30, NaN)).toBe(0);
    expect(completionPercent(0, 60)).toBe(0);
  });

  it("marks 80% or more as completed", () => {
    expect(isCompleted(79)).toBe(false);
    expect(isCompleted(80)).toBe(true);
  });
});

describe("aggregateStats", () => {
  it("counts plays, downloads and completions", () => {
    const stats = aggregateStats([
      row({}),
      row({ event_type: "download", seconds_watched: 0, completion_percent: 0 }),
      row({ event_type: "play", completion_percent: 95 }),
    ]);
    expect(stats.m1.views).toBe(3);
    expect(stats.m1.plays).toBe(2);
    expect(stats.m1.downloads).toBe(1);
    expect(stats.m1.completed).toBe(1);
  });

  it("counts each student once", () => {
    const stats = aggregateStats([
      row({ student_id: "s1" }),
      row({ student_id: "s1" }),
      row({ student_code: "HW1" }),
      row({}),
    ]);
    expect(stats.m1.uniqueStudents).toBe(2);
  });

  it("separates materials and sums minutes", () => {
    const stats = aggregateStats([row({ seconds_watched: 120 }), row({ material_id: "m2" })]);
    expect(stats.m1.totalMinutes).toBe(2);
    expect(stats.m2.views).toBe(1);
    expect(totalStats(stats).views).toBe(2);
  });

  it("tolerates an empty list", () => {
    expect(aggregateStats([])).toEqual({});
    expect(totalStats({}).views).toBe(0);
  });
});
