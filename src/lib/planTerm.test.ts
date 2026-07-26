import { describe, it, expect } from "vitest";
import { PLAN_TERMS, TERM_LABELS, activePlanFor, termLabel } from "./planTerm";

describe("term labels", () => {
  it("labels every term", () => {
    PLAN_TERMS.forEach((t) => expect(TERM_LABELS[t].trim()).not.toBe(""));
  });

  it("defaults an unset term to annual", () => {
    expect(termLabel(null)).toBe("سنوي");
    expect(termLabel(undefined)).toBe("سنوي");
    expect(termLabel("first")).toBe("الفصل الأول");
  });

  it("falls back to the raw value for an unknown term", () => {
    expect(termLabel("winter")).toBe("winter");
  });
});

describe("activePlanFor", () => {
  const annual = { id: "a", term: "annual", status: "active", start_date: "2026-01-01", end_date: "2026-12-31" };
  const first = { id: "f", term: "first", status: "active", start_date: "2026-01-01", end_date: "2026-05-31" };
  const summer = { id: "s", term: "summer", status: "active", start_date: "2026-06-01", end_date: "2026-08-31" };
  const suspended = { id: "x", term: "second", status: "suspended", start_date: "2026-01-01", end_date: "2026-12-31" };

  it("returns null when there is nothing to pick", () => {
    expect(activePlanFor([], "2026-03-01")).toBeNull();
    expect(activePlanFor(null, "2026-03-01")).toBeNull();
  });

  it("ignores suspended plans", () => {
    expect(activePlanFor([suspended], "2026-03-01")).toBeNull();
  });

  it("prefers the narrower plan when two contain the date", () => {
    expect(activePlanFor([annual, first], "2026-03-01")?.id).toBe("f");
  });

  it("picks the term whose range contains the date", () => {
    expect(activePlanFor([first, summer], "2026-07-01")?.id).toBe("s");
    expect(activePlanFor([first, summer], "2026-02-01")?.id).toBe("f");
  });

  it("falls back to any active plan when none contains the date", () => {
    expect(activePlanFor([summer], "2026-01-15")?.id).toBe("s");
  });

  it("treats a plan with no dates as open-ended", () => {
    const open = { id: "o", term: "annual", status: "active" };
    expect(activePlanFor([open], "2026-03-01")?.id).toBe("o");
    // ...but a dated plan that actually contains the date is more specific
    expect(activePlanFor([open, first], "2026-03-01")?.id).toBe("f");
  });

  it("treats a missing status as active", () => {
    expect(activePlanFor([{ id: "n", start_date: "2026-01-01", end_date: "2026-12-31" }], "2026-03-01")?.id).toBe("n");
  });
});
