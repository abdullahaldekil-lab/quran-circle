import { describe, expect, it } from "vitest";
import { guardianChildCount, reportRange, validBehaviorPoints } from "./guardianReports";
import { sumBehaviorPoints } from "./behavior";

describe("guardian and teacher daily workflows", () => {
  it("daily notifications include only the selected day", () => {
    expect(reportRange("daily", "2026-10-31", "2026-10-25", "2026-10-29")).toEqual({ from: "2026-10-31", to: "2026-10-31" });
  });
  it("keeps weekly notifications available", () => {
    expect(reportRange("weekly", "2026-10-31", "2026-10-25", "2026-10-29")).toEqual({ from: "2026-10-25", to: "2026-10-29" });
  });
  it("counts each active child once for the chosen guardian", () => {
    expect(guardianChildCount([
      { guardian_id: "g1", student_id: "s1", active: true },
      { guardian_id: "g1", student_id: "s1", active: true },
      { guardian_id: "g1", student_id: "s2", active: true },
      { guardian_id: "g1", student_id: "s3", active: false },
      { guardian_id: "g2", student_id: "s4", active: true },
    ], "g1")).toBe(2);
  });
  it("accumulates positive and negative student points", () => {
    expect(sumBehaviorPoints([{ points: 5 }, { points: -3 }, { points: 7 }])).toBe(9);
  });
  it("accepts entered integer points but rejects empty or fractional points", () => {
    expect(validBehaviorPoints("7")).toBe(true);
    expect(validBehaviorPoints("-2")).toBe(true);
    expect(validBehaviorPoints("")).toBe(false);
    expect(validBehaviorPoints("1.5")).toBe(false);
  });
});