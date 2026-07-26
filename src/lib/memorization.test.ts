import { describe, it, expect } from "vitest";
import { MUSHAF_TOTAL_PAGES } from "./mushaf";
import {
  EMPTY_BASELINE,
  computeTotalMemorizedPages,
  juzEquivalent,
  lastPageOfJuzRange,
  memorizedPercent,
  pageSetFromRanges,
  pagesForJuzRange,
  parseLegacyMemorizationAmount,
} from "./memorization";

const ref = (page: number) => `صفحة ${page} (الجزء 1)`;

describe("pageSetFromRanges", () => {
  it("expands a range into its pages", () => {
    expect([...pageSetFromRanges([{ from: ref(10), to: ref(12) }])]).toEqual([10, 11, 12]);
  });

  it("counts overlapping ranges once", () => {
    const pages = pageSetFromRanges([
      { from: ref(10), to: ref(12) },
      { from: ref(11), to: ref(14) },
    ]);
    expect(pages.size).toBe(5); // 10..14, not 3 + 4
  });

  it("handles a reversed range", () => {
    expect(pageSetFromRanges([{ from: ref(12), to: ref(10) }]).size).toBe(3);
  });

  it("handles a single-bound range", () => {
    expect([...pageSetFromRanges([{ from: ref(7), to: null }])]).toEqual([7]);
  });

  it("ignores empty and unparseable ranges", () => {
    expect(pageSetFromRanges([{ from: null, to: null }, { from: "", to: "" }]).size).toBe(0);
    expect(pageSetFromRanges([]).size).toBe(0);
  });
});

describe("computeTotalMemorizedPages", () => {
  it("returns the baseline when nothing new was recited", () => {
    expect(computeTotalMemorizedPages({ pages: 100, upToPage: 100, source: "plan" }, [])).toBe(100);
  });

  it("adds only pages beyond the baseline position", () => {
    const total = computeTotalMemorizedPages(
      { pages: 100, upToPage: 100, source: "plan" },
      [{ from: ref(99), to: ref(103) }], // 99,100 already counted; 101..103 are new
    );
    expect(total).toBe(103);
  });

  it("counts everything when there is no baseline position", () => {
    expect(computeTotalMemorizedPages(EMPTY_BASELINE, [{ from: ref(1), to: ref(5) }])).toBe(5);
  });

  it("never exceeds the mushaf", () => {
    const total = computeTotalMemorizedPages(
      { pages: 600, upToPage: 600, source: "manual" },
      [{ from: "صفحة 601 (الجزء 30)", to: "صفحة 604 (الجزء 30)" }],
    );
    expect(total).toBe(MUSHAF_TOTAL_PAGES);
  });

  it("does not double count a page recited twice", () => {
    const total = computeTotalMemorizedPages(EMPTY_BASELINE, [
      { from: ref(10), to: ref(11) },
      { from: ref(10), to: ref(11) },
    ]);
    expect(total).toBe(2);
  });

  it("clamps a nonsensical baseline", () => {
    expect(computeTotalMemorizedPages({ pages: -5, upToPage: null, source: "manual" }, [])).toBe(0);
    expect(computeTotalMemorizedPages({ pages: 9999, upToPage: null, source: "manual" }, [])).toBe(
      MUSHAF_TOTAL_PAGES,
    );
  });
});

describe("memorizedPercent / juzEquivalent", () => {
  it("is 0 for nothing and 100 for the whole mushaf", () => {
    expect(memorizedPercent(0)).toBe(0);
    expect(memorizedPercent(MUSHAF_TOTAL_PAGES)).toBe(100);
    expect(memorizedPercent(null)).toBe(0);
  });

  it("clamps out-of-range values", () => {
    expect(memorizedPercent(-10)).toBe(0);
    expect(memorizedPercent(9999)).toBe(100);
  });

  it("converts pages to an approximate juz count", () => {
    expect(juzEquivalent(0)).toBe(0);
    expect(juzEquivalent(MUSHAF_TOTAL_PAGES)).toBe(30);
    expect(juzEquivalent(MUSHAF_TOTAL_PAGES / 2)).toBe(15);
  });
});

describe("juz range helpers", () => {
  it("counts pages in a juz range", () => {
    expect(pagesForJuzRange(1, 1)).toBe(21);
    expect(pagesForJuzRange(1, 30)).toBe(MUSHAF_TOTAL_PAGES);
  });

  it("gives the last page of the range", () => {
    expect(lastPageOfJuzRange(1, 30)).toBe(MUSHAF_TOTAL_PAGES);
    expect(lastPageOfJuzRange(1, 1)).toBe(21);
  });

  it("returns 0 / null for an invalid range", () => {
    expect(pagesForJuzRange(5, 2)).toBe(0);
    expect(lastPageOfJuzRange(5, 2)).toBeNull();
  });
});

describe("parseLegacyMemorizationAmount", () => {
  it("reads juz counts", () => {
    expect(parseLegacyMemorizationAmount("5 أجزاء")).toBe(101);
    expect(parseLegacyMemorizationAmount("جزءان")).toBeNull(); // no digits to read
  });

  it("reads the common named portions", () => {
    expect(parseLegacyMemorizationAmount("جزء عم")).toBe(23);
    expect(parseLegacyMemorizationAmount("نصف القرآن")).toBe(302);
    expect(parseLegacyMemorizationAmount("القرآن كامل")).toBe(MUSHAF_TOTAL_PAGES);
  });

  it("reads pages and أوجه", () => {
    expect(parseLegacyMemorizationAmount("40 صفحة")).toBe(40);
    expect(parseLegacyMemorizationAmount("40 وجه")).toBe(20);
  });

  it("understands Arabic-Indic digits", () => {
    expect(parseLegacyMemorizationAmount("٥ أجزاء")).toBe(101);
  });

  it("treats a bare small number as juz", () => {
    expect(parseLegacyMemorizationAmount("3")).toBe(60);
  });

  it("recognises 'nothing memorized'", () => {
    expect(parseLegacyMemorizationAmount("لا يوجد")).toBe(0);
    expect(parseLegacyMemorizationAmount("مبتدئ")).toBe(0);
  });

  it("gives up rather than guessing", () => {
    expect(parseLegacyMemorizationAmount("")).toBeNull();
    expect(parseLegacyMemorizationAmount(null)).toBeNull();
    expect(parseLegacyMemorizationAmount("كلام غير مفهوم")).toBeNull();
    expect(parseLegacyMemorizationAmount("3 سور")).toBeNull();
  });
});
