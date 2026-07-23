import { describe, it, expect } from "vitest";
import { calcNewScore, calcLinkScore, calcTotalScore, type DailyRecordInput } from "./summer-scoring";

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
