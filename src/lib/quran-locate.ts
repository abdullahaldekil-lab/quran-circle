// Bidirectional Quran locator: surah/ayah ⇄ page ⇄ juz/hizb, plus أوجه counting.
// Used by the annual plan form so entering any one input fills in the rest.

import { MUSHAF_TOTAL_PAGES, pageToJuz } from "./mushaf";
import { HIZB_QUARTER_STARTS, PAGE_STARTS, SURAH_AYAHS, SURAH_NAMES } from "./quran-index";
import { normalizeDigits } from "./planRanges";

export interface AyahRef {
  surah: number;
  ayah: number;
}

/** Program convention: one full page = 2 أوجه (نصف وجه = ربع صفحة يومياً). */
export const AWJUH_PER_PAGE = 2;

const stripDiacritics = (s: string) => s.replace(/[\u064B-\u0652\u0670\u06D6-\u06ED\u0640]/g, "");

/** Normalize an Arabic surah name for tolerant matching. */
export const normalizeArabic = (raw: string): string =>
  stripDiacritics(normalizeDigits(String(raw ?? "")))
    .replace(/[إأآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\u0621-\u064A0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const stripPrefix = (s: string) =>
  s.replace(/^سوره\s+/, "").replace(/^ال(?=.{3,})/, "");

const NORMALIZED = SURAH_NAMES.map((n) => normalizeArabic(n));

/** Resolve a surah from free text ("البقرة", "سورة بقره", "2"). */
export const findSurah = (raw?: string | null): number | null => {
  const text = normalizeArabic(raw ?? "");
  if (!text) return null;
  if (/^\d+$/.test(text)) {
    const n = Number(text);
    return n >= 1 && n <= 114 ? n : null;
  }
  const exact = NORMALIZED.indexOf(text);
  if (exact >= 0) return exact + 1;
  const bare = stripPrefix(text);
  const loose = NORMALIZED.findIndex((n) => stripPrefix(n) === bare);
  if (loose >= 0) return loose + 1;
  const partial = NORMALIZED.findIndex((n) => n.includes(bare) || bare.includes(stripPrefix(n)));
  return partial >= 0 ? partial + 1 : null;
};

export const surahName = (surah: number): string => SURAH_NAMES[surah - 1] ?? "";
export const surahAyahCount = (surah: number): number => SURAH_AYAHS[surah - 1] ?? 0;

/** Suggestions for a surah autocomplete. */
export const searchSurahs = (query: string, limit = 8): { number: number; name: string }[] => {
  const q = stripPrefix(normalizeArabic(query));
  const all = SURAH_NAMES.map((name, i) => ({ number: i + 1, name }));
  if (!q) return all.slice(0, limit);
  return all
    .filter((s) => stripPrefix(NORMALIZED[s.number - 1]).includes(q) || String(s.number) === q)
    .slice(0, limit);
};

/** Parse "البقرة 141" / "2:141" / "البقرة" into a surah+ayah reference. */
export const parseAyahRef = (raw?: string | null): AyahRef | null => {
  const text = normalizeDigits(String(raw ?? "").trim());
  if (!text) return null;
  const colon = text.match(/^(\d{1,3})\s*[:،/]\s*(\d{1,3})$/);
  if (colon) {
    const surah = Number(colon[1]);
    if (surah < 1 || surah > 114) return null;
    return clampRef({ surah, ayah: Number(colon[2]) });
  }
  const m = text.match(/(\d+)\s*$/);
  const namePart = (m ? text.slice(0, m.index) : text).trim();
  const surah = findSurah(namePart || text);
  if (!surah) return null;
  return clampRef({ surah, ayah: m ? Number(m[1]) : 1 });
};

const clampRef = (r: AyahRef): AyahRef => ({
  surah: r.surah,
  ayah: Math.max(1, Math.min(surahAyahCount(r.surah) || 1, Math.round(r.ayah) || 1)),
});

export const formatAyahRef = (r: AyahRef | null): string =>
  r ? `${surahName(r.surah)} ${r.ayah}` : "";

// Absolute ayah ordinal (1..6236) — used for hizb lookup.
const CUMULATIVE: number[] = (() => {
  const out: number[] = [0];
  for (let i = 0; i < SURAH_AYAHS.length; i++) out.push(out[i] + SURAH_AYAHS[i]);
  return out;
})();

export const absoluteAyah = (r: AyahRef): number => CUMULATIVE[r.surah - 1] + r.ayah;

/** Mushaf page holding a given ayah. */
export const ayahToPage = (r: AyahRef | null): number | null => {
  if (!r) return null;
  const target = absoluteAyah(clampRef(r));
  let page = 1;
  for (let i = 0; i < PAGE_STARTS.length; i++) {
    const start = absoluteAyah({ surah: PAGE_STARTS[i][0], ayah: PAGE_STARTS[i][1] });
    if (start <= target) page = i + 1;
    else break;
  }
  return page;
};

/** First ayah printed on a page. */
export const pageStartRef = (page: number): AyahRef | null => {
  const p = Math.round(page);
  if (!p || p < 1 || p > MUSHAF_TOTAL_PAGES) return null;
  const [surah, ayah] = PAGE_STARTS[p - 1];
  return { surah, ayah };
};

/** Last ayah printed on a page. */
export const pageEndRef = (page: number): AyahRef | null => {
  const p = Math.round(page);
  if (!p || p < 1 || p > MUSHAF_TOTAL_PAGES) return null;
  if (p === MUSHAF_TOTAL_PAGES) return { surah: 114, ayah: surahAyahCount(114) };
  const next = pageStartRef(p + 1)!;
  const abs = absoluteAyah(next) - 1;
  return absoluteToRef(abs);
};

export const absoluteToRef = (abs: number): AyahRef => {
  const target = Math.max(1, Math.min(CUMULATIVE[114], Math.round(abs)));
  let surah = 1;
  for (let i = 1; i <= 114; i++) if (CUMULATIVE[i - 1] < target) surah = i;
  return { surah, ayah: target - CUMULATIVE[surah - 1] };
};

/** Hizb number (1..60) of an ayah. */
export const ayahToHizb = (r: AyahRef | null): number | null => {
  if (!r) return null;
  const target = absoluteAyah(clampRef(r));
  let quarter = 1;
  for (let i = 0; i < HIZB_QUARTER_STARTS.length; i++) {
    const start = absoluteAyah({ surah: HIZB_QUARTER_STARTS[i][0], ayah: HIZB_QUARTER_STARTS[i][1] });
    if (start <= target) quarter = i + 1;
    else break;
  }
  return Math.floor((quarter - 1) / 4) + 1;
};

export const pageToHizb = (page: number): number | null => ayahToHizb(pageStartRef(page));

/** Everything derived for one memorization segment. */
export interface SegmentInfo {
  fromPage: number;
  toPage: number;
  pages: number;
  awjuh: number;
  fromRef: AyahRef;
  toRef: AyahRef;
  juzFrom: number;
  juzTo: number;
  hizbFrom: number;
  hizbTo: number;
}

const buildSegment = (fromPage: number, toPage: number, fromRef: AyahRef, toRef: AyahRef): SegmentInfo => {
  const a = Math.min(fromPage, toPage);
  const b = Math.max(fromPage, toPage);
  const pages = b - a + 1;
  return {
    fromPage: a,
    toPage: b,
    pages,
    awjuh: pages * AWJUH_PER_PAGE,
    fromRef,
    toRef,
    juzFrom: pageToJuz(a),
    juzTo: pageToJuz(b),
    hizbFrom: pageToHizb(a) ?? 1,
    hizbTo: pageToHizb(b) ?? 1,
  };
};

/** From surah/ayah bounds (accepts free text such as "البقرة 1" → "البقرة 141"). */
export const segmentFromAyahs = (
  from?: string | AyahRef | null,
  to?: string | AyahRef | null,
): SegmentInfo | null => {
  const a = typeof from === "string" || from == null ? parseAyahRef(from as string) : clampRef(from);
  const b = typeof to === "string" || to == null ? parseAyahRef(to as string) : clampRef(to);
  if (!a || !b) return null;
  const pa = ayahToPage(a)!;
  const pb = ayahToPage(b)!;
  const ordered = absoluteAyah(a) <= absoluteAyah(b) ? [a, b] : [b, a];
  return buildSegment(pa, pb, ordered[0], ordered[1]);
};

/** From page bounds. */
export const segmentFromPages = (from?: number | null, to?: number | null): SegmentInfo | null => {
  if (!from || !to) return null;
  const a = Math.max(1, Math.min(MUSHAF_TOTAL_PAGES, Math.round(from)));
  const b = Math.max(1, Math.min(MUSHAF_TOTAL_PAGES, Math.round(to)));
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  return buildSegment(lo, hi, pageStartRef(lo)!, pageEndRef(hi)!);
};

/** From a juz range (whole juz). */
export const segmentFromJuz = (from?: number | null, to?: number | null): SegmentInfo | null => {
  if (!from) return null;
  const juzFrom = Math.max(1, Math.min(30, Math.round(from)));
  const juzTo = Math.max(juzFrom, Math.min(30, Math.round(to || from)));
  const start = juzStartPage(juzFrom);
  const end = juzTo >= 30 ? MUSHAF_TOTAL_PAGES : juzStartPage(juzTo + 1) - 1;
  return segmentFromPages(start, end);
};

const juzStartPage = (juz: number): number => {
  // Local copy avoids a circular import shape; identical to mushaf.JUZ_START_PAGE.
  const starts = [1, 22, 42, 62, 82, 102, 121, 142, 162, 182, 201, 222, 242, 262, 282, 302, 322, 342, 362, 382, 402, 422, 442, 462, 482, 502, 522, 542, 562, 582];
  return starts[Math.max(1, Math.min(30, juz)) - 1];
};

/** From a hizb range (1..60). */
export const segmentFromHizb = (from?: number | null, to?: number | null): SegmentInfo | null => {
  if (!from) return null;
  const hFrom = Math.max(1, Math.min(60, Math.round(from)));
  const hTo = Math.max(hFrom, Math.min(60, Math.round(to || from)));
  const startRef = HIZB_QUARTER_STARTS[(hFrom - 1) * 4];
  const startPage = ayahToPage({ surah: startRef[0], ayah: startRef[1] })!;
  let endPage = MUSHAF_TOTAL_PAGES;
  if (hTo < 60) {
    const nextRef = HIZB_QUARTER_STARTS[hTo * 4];
    endPage = Math.max(startPage, (ayahToPage({ surah: nextRef[0], ayah: nextRef[1] }) ?? MUSHAF_TOTAL_PAGES) - 1);
  }
  return segmentFromPages(startPage, endPage);
};

export const describeSegment = (s: SegmentInfo | null): string =>
  s
    ? `${formatAyahRef(s.fromRef)} → ${formatAyahRef(s.toRef)} • صفحة ${s.fromPage}-${s.toPage} • ` +
      `الجزء ${s.juzFrom === s.juzTo ? s.juzFrom : `${s.juzFrom}-${s.juzTo}`} • ` +
      `الحزب ${s.hizbFrom === s.hizbTo ? s.hizbFrom : `${s.hizbFrom}-${s.hizbTo}`} • ${s.awjuh} وجه`
    : "—";
