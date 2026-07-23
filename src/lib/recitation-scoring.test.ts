import { describe, it, expect } from "vitest";
import {
  aggregateCounts,
  calcScore,
  emptyBreakdown,
} from "./recitation-scoring";

describe("recitation scoring", () => {
  it("empty breakdown → perfect score 100", () => {
    expect(calcScore(emptyBreakdown())).toBe(100);
  });

  it("aggregates counts across sections", () => {
    const b = {
      memorization: { error: 1, lahn: 2, warning: 3 },
      review: { error: 0, lahn: 1, warning: 0 },
      linking: { error: 2, lahn: 0, warning: 1 },
    };
    expect(aggregateCounts(b)).toEqual({
      error: 3,
      lahn: 3,
      warning: 4,
      total: 10,
    });
  });

  it("applies deductions: 5/2/1 per category", () => {
    const b = {
      memorization: { error: 2, lahn: 3, warning: 4 },
      review: { error: 0, lahn: 0, warning: 0 },
      linking: { error: 0, lahn: 0, warning: 0 },
    };
    // 100 - 2*5 - 3*2 - 4*1 = 100 - 10 - 6 - 4 = 80
    expect(calcScore(b)).toBe(80);
  });

  it("never returns below zero", () => {
    const b = {
      memorization: { error: 50, lahn: 0, warning: 0 },
      review: { error: 0, lahn: 0, warning: 0 },
      linking: { error: 0, lahn: 0, warning: 0 },
    };
    expect(calcScore(b)).toBe(0);
  });

  it("tolerates missing sections and coerces non-numeric input", () => {
    const b: any = {
      memorization: { error: "1" as any, lahn: undefined, warning: null },
    };
    expect(aggregateCounts(b)).toEqual({
      error: 1,
      lahn: 0,
      warning: 0,
      total: 1,
    });
    expect(calcScore(b)).toBe(95);
  });
});
