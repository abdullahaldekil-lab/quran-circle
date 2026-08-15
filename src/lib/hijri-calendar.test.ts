import { describe, expect, it } from "vitest";
import { buildHijriMonth, isTaskLate, isWeekendDay, isWithinRange } from "./hijri-calendar";

describe("buildHijriMonth", () => {
  it("builds a full Hijri month with 29 or 30 days", () => {
    const g = buildHijriMonth(1448, 1);
    expect(g.days.length === 29 || g.days.length === 30).toBe(true);
    expect(g.days[0].hijriDay).toBe(1);
    expect(g.days[g.days.length - 1].hijriDay).toBe(g.days.length);
    expect(g.startIso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(g.endIso >= g.startIso).toBe(true);
    expect(g.label).toContain("1448");
  });

  it("keeps consecutive Gregorian days and a Sunday-based offset", () => {
    const g = buildHijriMonth(1448, 5);
    expect(g.leadingBlanks).toBe(g.days[0].weekday);
    for (let i = 1; i < g.days.length; i++) {
      expect(g.days[i].weekday).toBe((g.days[i - 1].weekday + 1) % 7);
      expect(g.days[i].iso > g.days[i - 1].iso).toBe(true);
    }
  });
});

describe("helpers", () => {
  it("flags Friday and Saturday as weekend", () => {
    expect(isWeekendDay(5)).toBe(true);
    expect(isWeekendDay(6)).toBe(true);
    expect(isWeekendDay(0)).toBe(false);
  });

  it("checks inclusive ranges", () => {
    expect(isWithinRange("2026-08-15", "2026-08-10", "2026-08-15")).toBe(true);
    expect(isWithinRange("2026-08-16", "2026-08-10", "2026-08-15")).toBe(false);
  });

  it("detects late tasks only for unfinished past-due work", () => {
    const today = "2026-08-15";
    expect(isTaskLate({ due_date: "2026-08-14", status: "pending" }, today)).toBe(true);
    expect(isTaskLate({ due_date: "2026-08-14", status: "completed" }, today)).toBe(false);
    expect(isTaskLate({ due_date: "2026-08-14", status: "cancelled" }, today)).toBe(false);
    expect(isTaskLate({ due_date: "2026-08-16", status: "pending" }, today)).toBe(false);
    expect(isTaskLate({ due_date: null, status: "pending" }, today)).toBe(false);
  });
});
