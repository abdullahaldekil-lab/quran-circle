import { describe, it, expect } from "vitest";
import {
  JUZ_START_PAGE,
  MUSHAF_TOTAL_PAGES,
  formatPageRef,
  juzRangeToPageBounds,
  nextDailyMushafRange,
  nextLinkingMushafRange,
  nextReviewMushafRange,
  pageToJuz,
  pagesStep,
  parsePageRef,
} from "./mushaf";

describe("parsePageRef", () => {
  it("reads the page out of the label the app writes", () => {
    expect(parsePageRef("صفحة 42 (الجزء 3)")).toBe(42);
  });

  it("reads a bare number", () => {
    expect(parsePageRef("42")).toBe(42);
  });

  it("returns null for empty input", () => {
    expect(parsePageRef(null)).toBeNull();
    expect(parsePageRef(undefined)).toBeNull();
    expect(parsePageRef("")).toBeNull();
    expect(parsePageRef("لا يوجد رقم")).toBeNull();
  });

  it("rejects a number outside the mushaf", () => {
    expect(parsePageRef("0")).toBeNull();
    expect(parsePageRef("605")).toBeNull();
    expect(parsePageRef("604")).toBe(604);
  });

  it("takes the first number, which is why legacy surah-style text is ambiguous", () => {
    // Older records stored "البقرة 5" — the 5 is an ayah, not a page. Documented so
    // callers know these values cannot be trusted as page references.
    expect(parsePageRef("البقرة 5")).toBe(5);
  });
});

describe("pageToJuz", () => {
  it("maps the first and last page", () => {
    expect(pageToJuz(1)).toBe(1);
    expect(pageToJuz(MUSHAF_TOTAL_PAGES)).toBe(30);
  });

  it("maps each juz start page to its own juz", () => {
    JUZ_START_PAGE.forEach((page, i) => expect(pageToJuz(page)).toBe(i + 1));
  });

  it("maps the page before a juz start to the previous juz", () => {
    expect(pageToJuz(JUZ_START_PAGE[1] - 1)).toBe(1);
  });
});

describe("pagesStep", () => {
  it("converts أوجه to whole pages, rounding up", () => {
    expect(pagesStep(1)).toBe(1);
    expect(pagesStep(2)).toBe(1);
    expect(pagesStep(3)).toBe(2);
    expect(pagesStep(4)).toBe(2);
  });

  it("never returns less than one page", () => {
    expect(pagesStep(0)).toBe(1);
    expect(pagesStep(-5)).toBe(1);
    expect(pagesStep(NaN)).toBe(1);
  });
});

describe("nextDailyMushafRange", () => {
  it("starts at the beginning when there is no previous record", () => {
    const r = nextDailyMushafRange(null, 2);
    expect(r.from).toBe(1);
    expect(r.to).toBe(1);
    expect(r.completed).toBe(false);
  });

  it("continues from the page after the last memorized one", () => {
    const r = nextDailyMushafRange("صفحة 42 (الجزء 3)", 4);
    expect(r.from).toBe(43);
    expect(r.to).toBe(44);
  });

  it("clamps at the end of the mushaf and reports completion", () => {
    const r = nextDailyMushafRange("صفحة 604 (الجزء 30)", 4);
    expect(r.to).toBe(MUSHAF_TOTAL_PAGES);
    expect(r.completed).toBe(true);
  });

  it("respects explicit bounds", () => {
    const r = nextDailyMushafRange(null, 6, { start: 100, end: 102 });
    expect(r.from).toBe(100);
    expect(r.to).toBe(102);
  });

  it("labels the range with its juz", () => {
    expect(formatPageRef(1)).toBe("صفحة 1 (الجزء 1)");
  });
});

describe("nextReviewMushafRange", () => {
  const memorized = { start: 1, end: 20 };

  it("returns null when the student has memorized nothing yet", () => {
    expect(nextReviewMushafRange(null, 2, { start: 5, end: 4 })).toBeNull();
  });

  it("starts at the beginning of the memorized portion", () => {
    const r = nextReviewMushafRange(null, 4, memorized)!;
    expect(r.from).toBe(1);
    expect(r.to).toBe(2);
    expect(r.wrapped).toBe(false);
  });

  it("continues after the last reviewed page", () => {
    const r = nextReviewMushafRange("صفحة 10 (الجزء 1)", 4, memorized)!;
    expect(r.from).toBe(11);
    expect(r.to).toBe(12);
  });

  it("wraps back to the start once the memorized portion is finished", () => {
    const r = nextReviewMushafRange("صفحة 20 (الجزء 1)", 4, memorized)!;
    expect(r.from).toBe(1);
    expect(r.wrapped).toBe(true);
  });

  it("never runs past the memorized portion", () => {
    const r = nextReviewMushafRange("صفحة 19 (الجزء 1)", 20, memorized)!;
    expect(r.to).toBe(20);
  });

  it("restarts when the stored position is before the portion", () => {
    const r = nextReviewMushafRange("صفحة 2 (الجزء 1)", 2, { start: 10, end: 20 })!;
    expect(r.from).toBe(10);
  });
});

describe("nextLinkingMushafRange", () => {
  it("returns the pages immediately before today's new portion", () => {
    const r = nextLinkingMushafRange(43, 4)!;
    expect(r.to).toBe(42);
    expect(r.from).toBe(41);
  });

  it("returns null at the very beginning of the plan", () => {
    expect(nextLinkingMushafRange(1, 4)).toBeNull();
    expect(nextLinkingMushafRange(100, 4, { start: 100, end: 200 })).toBeNull();
  });

  it("returns null when today's portion is unknown", () => {
    expect(nextLinkingMushafRange(null, 4)).toBeNull();
  });

  it("does not reach before the plan start", () => {
    const r = nextLinkingMushafRange(102, 20, { start: 100, end: 200 })!;
    expect(r.from).toBe(100);
    expect(r.to).toBe(101);
  });
});

describe("juzRangeToPageBounds", () => {
  it("covers whole juz ranges", () => {
    expect(juzRangeToPageBounds(1, 1)).toEqual({ start: 1, end: 21, total: 21 });
    expect(juzRangeToPageBounds(30, 30)).toEqual({ start: 582, end: 604, total: 23 });
  });

  it("returns null for an invalid range", () => {
    expect(juzRangeToPageBounds(5, 2)).toBeNull();
    expect(juzRangeToPageBounds(null, 3)).toBeNull();
  });
});
