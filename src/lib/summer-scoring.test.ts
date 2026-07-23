import { describe, it, expect } from "vitest";
import {
  calcNewScore, calcLinkScore, calcTotalScore,
  juzRangeToPages, computeWorkingDays, computeDailyPagesWorking,
  type DailyRecordInput,
} from "./summer-scoring";

const base: DailyRecordInput = {
  plan_type: "hifz",
  new_notifications: 0,
  new_mistakes_lahn: 0,
  new_listening_done: false,
  new_repetitions_done: false,
  new_test_score: 0,
  link_notifications: 0,
  link_mistakes_lahn: 0,
  amyal_score: 0,
};

describe("summer-scoring", () => {
  it("hifz perfect card = 40", () => {
    const r: DailyRecordInput = { ...base, new_listening_done: true, new_repetitions_done: true };
    expect(calcNewScore(r)).toBe(15);
    expect(calcLinkScore(r)).toBe(15);
    expect(calcTotalScore(r)).toBe(40);
  });

  it("taahud perfect card = 40", () => {
    const r: DailyRecordInput = { ...base, plan_type: "taahud", new_test_score: 5, amyal_score: 5 };
    expect(calcNewScore(r)).toBe(15);
    expect(calcLinkScore(r)).toBe(15);
    expect(calcTotalScore(r)).toBe(40);
  });

  it("penalizes mistakes and notifications in new section", () => {
    const r = { ...base, new_notifications: 2, new_mistakes_lahn: 1 };
    // base = 10 - 1 - 1 = 8, no bonus => 8
    expect(calcNewScore(r)).toBe(8);
  });

  it("caps at zero when heavily penalized", () => {
    const r = { ...base, new_notifications: 40, new_mistakes_lahn: 40 };
    expect(calcNewScore(r)).toBe(0);
  });

  it("hifz without listening/repetitions loses 5 pts", () => {
    const r: DailyRecordInput = { ...base, new_listening_done: false, new_repetitions_done: true };
    expect(calcNewScore(r)).toBe(12.5);
  });
});

describe("summer-plan (Madinah mushaf distribution)", () => {
  it("juz 1..7 = 140 pages per Madinah mushaf", () => {
    expect(juzRangeToPages(1, 7)).toBe(140);
    expect(juzRangeToPages(1, 1)).toBe(20);
    expect(juzRangeToPages(1, 30)).toBe(600);
  });

  it("invalid juz ranges yield 0", () => {
    expect(juzRangeToPages(0, 5)).toBe(0);
    expect(juzRangeToPages(7, 1)).toBe(0);
  });

  it("counts Sun-Thu only as working days", () => {
    // 2026-07-19 is a Sunday; Sun..Thu = 5 working days
    expect(computeWorkingDays("2026-07-19", "2026-07-23")).toBe(5);
    // adding Friday+Saturday changes nothing
    expect(computeWorkingDays("2026-07-19", "2026-07-25")).toBe(5);
    // full two weeks = 10 working days
    expect(computeWorkingDays("2026-07-19", "2026-08-01")).toBe(10);
  });

  it("excludes official holidays from working days", () => {
    const holidays = [{ start_date: "2026-07-21", end_date: "2026-07-22" }];
    expect(computeWorkingDays("2026-07-19", "2026-07-23", holidays)).toBe(3);
    // holiday falling on a weekend does not double-subtract
    const weekendHoliday = [{ start_date: "2026-07-24", end_date: "2026-07-25" }];
    expect(computeWorkingDays("2026-07-19", "2026-07-25", weekendHoliday)).toBe(5);
  });

  it("distributes pages over working days, clamped 1..20 per day", () => {
    expect(computeDailyPagesWorking(140, 20)).toBe(7);   // juz 1-7 over 20 working days
    expect(computeDailyPagesWorking(10, 40)).toBe(1);    // minimum one wajh/day
    expect(computeDailyPagesWorking(600, 10)).toBe(20);  // capped at 20 wajh/day
    expect(computeDailyPagesWorking(140, 0)).toBe(0);    // no working days -> no plan
  });
});
