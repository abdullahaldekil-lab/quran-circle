import { describe, it, expect } from "vitest";
import {
  normalizePace,
  paceLabel,
  isStudyDay,
  countStudyDays,
  addStudyDays,
  daysNeededFor,
  parsePagesFromText,
  achievedPages,
  buildPaceSummary,
  commitmentTone,
} from "./madarij-pace";

describe("madarij pace", () => {
  it("normalizes the pace to half or full page only", () => {
    expect(normalizePace(0.5)).toBe(0.5);
    expect(normalizePace("0.5")).toBe(0.5);
    expect(normalizePace(3)).toBe(1);
    expect(normalizePace(null)).toBe(1);
    expect(paceLabel(0.5)).toBe("نصف وجه يومياً");
    expect(paceLabel(1)).toBe("وجه كامل يومياً");
  });

  it("treats Friday and Saturday and holidays as non study days", () => {
    // 2026-08-21 is a Friday, 2026-08-22 a Saturday, 2026-08-23 a Sunday
    expect(isStudyDay("2026-08-21")).toBe(false);
    expect(isStudyDay("2026-08-22")).toBe(false);
    expect(isStudyDay("2026-08-23")).toBe(true);
    expect(isStudyDay("2026-08-23", ["2026-08-23"])).toBe(false);
  });

  it("counts study days inclusively", () => {
    // Sun 23 → Thu 27 = 5 study days, Fri/Sat excluded
    expect(countStudyDays("2026-08-23", "2026-08-27")).toBe(5);
    expect(countStudyDays("2026-08-23", "2026-08-29")).toBe(5);
    expect(countStudyDays("2026-08-23", "2026-08-22")).toBe(0);
    expect(countStudyDays("2026-08-23", "2026-08-27", ["2026-08-25"])).toBe(4);
  });

  it("projects an end date over study days only", () => {
    expect(addStudyDays("2026-08-23", 5)).toBe("2026-08-27");
    expect(addStudyDays("2026-08-23", 6)).toBe("2026-08-30");
    expect(addStudyDays("2026-08-23", 0)).toBeNull();
  });

  it("computes the days needed for a hizb and a juz", () => {
    expect(daysNeededFor(10, 1)).toBe(10);
    expect(daysNeededFor(10, 0.5)).toBe(20);
    expect(daysNeededFor(0, 1)).toBe(0);
  });

  it("reads amounts from Arabic follow-up text", () => {
    expect(parsePagesFromText("وجه واحد")).toBeNull();
    expect(parsePagesFromText("١ وجه")).toBe(1);
    expect(parsePagesFromText("0.5 وجه")).toBe(0.5);
    expect(parsePagesFromText("")).toBeNull();
  });

  it("falls back to the daily pace for filled entries without a number", () => {
    const records = [{ memorization: "وجه" }, { memorization: "2 أوجه" }, { memorization: "" }];
    expect(achievedPages(records, 0.5)).toBe(2.5);
  });

  it("summarises commitment against the plan", () => {
    const summary = buildPaceSummary({
      pace: 1,
      startDate: "2026-08-23",
      today: "2026-08-27",
      records: [{ memorization: "1" }, { memorization: "1" }, { memorization: "1" }],
    });
    expect(summary.targetToDate).toBe(5);
    expect(summary.achieved).toBe(3);
    expect(summary.commitment).toBe(60);
    expect(summary.daysAhead).toBe(-2);
    expect(summary.daysForHizb).toBe(10);
    expect(summary.expectedJuzEnd).toBe(addStudyDays("2026-08-23", 20));
  });

  it("maps commitment to a colour band", () => {
    expect(commitmentTone(90)).toBe("success");
    expect(commitmentTone(70)).toBe("warning");
    expect(commitmentTone(10)).toBe("danger");
  });
});
