import { describe, it, expect } from "vitest";
import {
  actualPagesFromRecord,
  aggregateActuals,
  commitmentPercentage,
  monthNumberFor,
  pagesInRange,
  progressStatus,
} from "./planProgress";

describe("pagesInRange", () => {
  it("counts an inclusive page range", () => {
    expect(pagesInRange("صفحة 10 (الجزء 1)", "صفحة 12 (الجزء 1)")).toBe(3);
  });

  it("counts a single page as one", () => {
    expect(pagesInRange("صفحة 10 (الجزء 1)", "صفحة 10 (الجزء 1)")).toBe(1);
  });

  it("returns 0 for an empty section", () => {
    expect(pagesInRange(null, null)).toBe(0);
    expect(pagesInRange("", "")).toBe(0);
    expect(pagesInRange("   ", undefined)).toBe(0);
  });

  it("returns 0 rather than a negative for a reversed range", () => {
    expect(pagesInRange("صفحة 12 (الجزء 1)", "صفحة 10 (الجزء 1)")).toBe(0);
  });

  it("credits one page when the section is filled but unparseable", () => {
    expect(pagesInRange("سورة البقرة", "سورة آل عمران")).toBe(1);
  });

  it("credits one page when only one bound was recorded", () => {
    expect(pagesInRange("صفحة 10 (الجزء 1)", null)).toBe(1);
  });
});

describe("actualPagesFromRecord", () => {
  it("splits the three sections and totals them", () => {
    const pages = actualPagesFromRecord({
      memorized_from: "صفحة 43 (الجزء 3)",
      memorized_to: "صفحة 44 (الجزء 3)",
      review_from: "صفحة 1 (الجزء 1)",
      review_to: "صفحة 4 (الجزء 1)",
      linking_from: "صفحة 42 (الجزء 3)",
      linking_to: "صفحة 42 (الجزء 3)",
    });
    expect(pages).toEqual({ mem: 2, rev: 4, link: 1, total: 7 });
  });

  it("is all zeros for an empty record", () => {
    expect(actualPagesFromRecord({})).toEqual({ mem: 0, rev: 0, link: 0, total: 0 });
  });

  it("credits only the sections the teacher filled", () => {
    const pages = actualPagesFromRecord({
      memorized_from: "صفحة 5 (الجزء 1)",
      memorized_to: "صفحة 6 (الجزء 1)",
    });
    expect(pages).toEqual({ mem: 2, rev: 0, link: 0, total: 2 });
  });
});

describe("monthNumberFor", () => {
  it("puts the plan start in month 1", () => {
    expect(monthNumberFor("2026-01-15", "2026-01-20")).toBe(1);
  });

  it("counts calendar months, not 30-day blocks", () => {
    expect(monthNumberFor("2026-01-15", "2026-02-01")).toBe(2);
    expect(monthNumberFor("2026-01-15", "2026-03-31")).toBe(3);
  });

  it("crosses a year boundary", () => {
    expect(monthNumberFor("2026-11-01", "2027-02-10")).toBe(4);
  });

  it("clamps dates before the plan start to month 1", () => {
    expect(monthNumberFor("2026-05-01", "2026-01-01")).toBe(1);
  });

  it("falls back to month 1 on an unparseable date", () => {
    expect(monthNumberFor("not-a-date", "2026-01-01")).toBe(1);
  });
});

describe("aggregateActuals", () => {
  it("buckets records by plan month", () => {
    const buckets = aggregateActuals(
      [
        { record_date: "2026-01-20", memorized_from: "صفحة 1 (الجزء 1)", memorized_to: "صفحة 2 (الجزء 1)" },
        { record_date: "2026-01-25", memorized_from: "صفحة 3 (الجزء 1)", memorized_to: "صفحة 3 (الجزء 1)" },
        { record_date: "2026-02-02", memorized_from: "صفحة 4 (الجزء 1)", memorized_to: "صفحة 5 (الجزء 1)" },
      ],
      "2026-01-15",
    );
    expect(buckets[1].mem).toBe(3);
    expect(buckets[2].mem).toBe(2);
    expect(buckets[3]).toBeUndefined();
  });

  it("returns an empty object for no records", () => {
    expect(aggregateActuals([], "2026-01-01")).toEqual({});
  });
});

describe("commitmentPercentage", () => {
  it("computes a normal percentage", () => {
    expect(commitmentPercentage(35, 50)).toBe(70);
  });

  it("caps at 100", () => {
    expect(commitmentPercentage(80, 50)).toBe(100);
  });

  it("returns 0 instead of NaN or Infinity when nothing is targeted", () => {
    expect(commitmentPercentage(10, 0)).toBe(0);
    expect(commitmentPercentage(0, 0)).toBe(0);
  });
});

describe("progressStatus", () => {
  it("classifies at the boundaries", () => {
    expect(progressStatus(100)).toBe("ahead");
    expect(progressStatus(99)).toBe("on_track");
    expect(progressStatus(70)).toBe("on_track");
    expect(progressStatus(69)).toBe("behind");
    expect(progressStatus(0)).toBe("behind");
  });
});
