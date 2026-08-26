import { describe, it, expect } from "vitest";
import { MUSHAF_TOTAL_PAGES } from "./mushaf";
import {
  ayahToHizb,
  ayahToPage,
  findSurah,
  formatAyahRef,
  pageEndRef,
  pageStartRef,
  parseAyahRef,
  searchSurahs,
  segmentFromAyahs,
  segmentFromHizb,
  segmentFromJuz,
  segmentFromPages,
} from "./quran-locate";

describe("findSurah", () => {
  it("matches exact, prefixed and loose names", () => {
    expect(findSurah("البقرة")).toBe(2);
    expect(findSurah("سورة بقره")).toBe(2);
    expect(findSurah("الفاتحه")).toBe(1);
    expect(findSurah("2")).toBe(2);
  });

  it("returns null for nonsense", () => {
    expect(findSurah("")).toBeNull();
    expect(findSurah("xyz")).toBeNull();
    expect(findSurah("200")).toBeNull();
  });
});

describe("parseAyahRef", () => {
  it("reads name + ayah, arabic digits and colon form", () => {
    expect(parseAyahRef("البقرة 141")).toEqual({ surah: 2, ayah: 141 });
    expect(parseAyahRef("البقرة ١٤١")).toEqual({ surah: 2, ayah: 141 });
    expect(parseAyahRef("2:141")).toEqual({ surah: 2, ayah: 141 });
  });

  it("defaults to ayah 1 and clamps overflow", () => {
    expect(parseAyahRef("الفاتحة")).toEqual({ surah: 1, ayah: 1 });
    expect(parseAyahRef("الفاتحة 99")).toEqual({ surah: 1, ayah: 7 });
  });
});

describe("ayah ⇄ page", () => {
  it("maps known landmarks", () => {
    expect(ayahToPage({ surah: 1, ayah: 1 })).toBe(1);
    expect(ayahToPage({ surah: 2, ayah: 1 })).toBe(2);
    expect(ayahToPage({ surah: 114, ayah: 1 })).toBe(MUSHAF_TOTAL_PAGES);
  });

  it("page bounds are consistent", () => {
    expect(pageStartRef(1)).toEqual({ surah: 1, ayah: 1 });
    expect(pageEndRef(MUSHAF_TOTAL_PAGES)).toEqual({ surah: 114, ayah: 6 });
    expect(pageStartRef(0)).toBeNull();
    expect(pageStartRef(605)).toBeNull();
  });

  it("round-trips every page start", () => {
    for (let p = 1; p <= MUSHAF_TOTAL_PAGES; p++) {
      expect(ayahToPage(pageStartRef(p))).toBe(p);
    }
  });
});

describe("hizb", () => {
  it("starts and ends within 1..60", () => {
    expect(ayahToHizb({ surah: 1, ayah: 1 })).toBe(1);
    expect(ayahToHizb({ surah: 114, ayah: 1 })).toBe(60);
  });
});

describe("segments", () => {
  it("derives pages, juz, hizb and أوجه from surah/ayah", () => {
    const s = segmentFromAyahs("البقرة 1", "البقرة 141")!;
    expect(s.fromPage).toBe(2);
    expect(s.toPage).toBe(21);
    expect(s.pages).toBe(20);
    expect(s.awjuh).toBe(20);
    expect(s.juzFrom).toBe(1);
    expect(formatAyahRef(s.fromRef)).toBe("البقرة 1");
  });

  it("orders reversed input", () => {
    const s = segmentFromAyahs("البقرة 141", "البقرة 1")!;
    expect(s.fromPage).toBe(2);
    expect(s.toPage).toBe(21);
  });

  it("derives refs from page bounds", () => {
    const s = segmentFromPages(1, 2)!;
    expect(s.pages).toBe(2);
    expect(s.fromRef).toEqual({ surah: 1, ayah: 1 });
    expect(s.juzFrom).toBe(1);
  });

  it("covers a whole juz range", () => {
    const s = segmentFromJuz(1, 1)!;
    expect(s.fromPage).toBe(1);
    expect(s.toPage).toBe(21);
    const last = segmentFromJuz(30, 30)!;
    expect(last.toPage).toBe(MUSHAF_TOTAL_PAGES);
  });

  it("covers a hizb range", () => {
    const s = segmentFromHizb(1, 1)!;
    expect(s.fromPage).toBe(1);
    expect(s.toPage).toBeGreaterThan(1);
    expect(segmentFromHizb(60, 60)!.toPage).toBe(MUSHAF_TOTAL_PAGES);
  });

  it("returns null for missing input", () => {
    expect(segmentFromAyahs("", "")).toBeNull();
    expect(segmentFromPages(null, 5)).toBeNull();
    expect(segmentFromJuz(null)).toBeNull();
  });
});

describe("searchSurahs", () => {
  it("suggests matches", () => {
    expect(searchSurahs("بقر").map((s) => s.number)).toContain(2);
    expect(searchSurahs("").length).toBe(8);
  });
});
