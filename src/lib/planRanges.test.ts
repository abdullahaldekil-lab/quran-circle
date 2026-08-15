import { describe, it, expect } from "vitest";
import { parsePoint, validatePlanRanges } from "./planRanges";

describe("parsePoint", () => {
  it("splits name and number, supporting arabic digits", () => {
    expect(parsePoint("البقرة 141")).toEqual({ name: "البقرة", num: 141 });
    expect(parsePoint("البقرة ١٤١")).toEqual({ name: "البقرة", num: 141 });
    expect(parsePoint("الفاتحة")).toEqual({ name: "الفاتحة", num: null });
  });
});

describe("validatePlanRanges", () => {
  it("accepts empty and valid rows", () => {
    expect(validatePlanRanges([]).valid).toBe(true);
    expect(validatePlanRanges([{ juz: "", from: "", to: "", pages: 0 }]).valid).toBe(true);
    expect(validatePlanRanges([{ juz: 1, from: "البقرة 1", to: "البقرة 141", pages: 10 }]).valid).toBe(true);
  });

  it("rejects from > to", () => {
    const v = validatePlanRanges([{ juz: 1, from: "البقرة 141", to: "البقرة 1", pages: 5 }]);
    expect(v.valid).toBe(false);
    expect(v.rowErrors[0].field).toBe("from");
    expect(v.rowErrors[0].message).toContain("البقرة 141");
    expect(v.messages[0]).toContain("الموضع 1");
  });

  it("rejects non-positive pages", () => {
    const v = validatePlanRanges([{ juz: 1, from: "البقرة 1", to: "البقرة 5", pages: 0 }]);
    expect(v.valid).toBe(false);
    expect(v.rowErrors[0].field).toBe("pages");
  });

  it("requires both bounds when a row is filled", () => {
    const v = validatePlanRanges([{ juz: 1, from: "البقرة 1", to: "", pages: 3 }]);
    expect(v.valid).toBe(false);
    expect(v.rowErrors[0].field).toBe("to");
  });

  it("detects overlapping ranges in the same juz", () => {
    const v = validatePlanRanges([
      { juz: 1, from: "البقرة 1", to: "البقرة 100", pages: 5 },
      { juz: 1, from: "البقرة 50", to: "البقرة 141", pages: 5 },
    ]);
    expect(v.valid).toBe(false);
    expect(Object.keys(v.rowErrors)).toHaveLength(2);
    expect(v.rowErrors[0].conflictsWith).toBe(2);
    expect(v.rowErrors[1].message).toContain("الموضع 1");
    expect(v.messages).toHaveLength(2);
  });

  it("allows adjacent non-overlapping ranges", () => {
    const v = validatePlanRanges([
      { juz: 1, from: "البقرة 1", to: "البقرة 49", pages: 5 },
      { juz: 1, from: "البقرة 50", to: "البقرة 141", pages: 5 },
    ]);
    expect(v.valid).toBe(true);
  });

  it("does not compare ranges across different juz", () => {
    const v = validatePlanRanges([
      { juz: 1, from: "البقرة 1", to: "البقرة 100", pages: 5 },
      { juz: 2, from: "البقرة 50", to: "البقرة 141", pages: 5 },
    ]);
    expect(v.valid).toBe(true);
  });
});
