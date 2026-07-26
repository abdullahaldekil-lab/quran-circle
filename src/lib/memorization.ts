// The student's accumulated memorized portion (المحفوظ).
//
// `students.total_memorized_pages` existed but no code path ever wrote to it, so every
// "X / 604" bar in the app and the ختم counter on the KPI dashboard sat at zero
// forever. Three fields held overlapping truth:
//
//   students.total_memorized_pages           → the number everything reads
//   student_annual_plans.previous_memorized_* → the baseline captured when planning
//   students.memorization_amount              → free text captured at enrolment
//
// The rule adopted here: `total_memorized_pages` is the single derived number,
// = baseline + distinct new pages memorized since, capped at the mushaf. It is a set
// of pages, not a running sum, so re-reciting the same page does not double-count.
// `memorization_amount` stays a display-only note from the registration form.

import { JUZ_START_PAGE, MUSHAF_TOTAL_PAGES, juzRangeToPageBounds, parsePageRef } from "./mushaf";

export type BaselineSource = "plan" | "manual" | "legacy_text" | "import" | "none";

export interface MemorizedBaseline {
  pages: number;
  upToPage: number | null;
  source: BaselineSource;
}

export const EMPTY_BASELINE: MemorizedBaseline = { pages: 0, upToPage: null, source: "none" };

export interface PageRange {
  from?: string | null;
  to?: string | null;
}

/** Distinct mushaf pages covered by a set of ranges — overlaps count once. */
export const pageSetFromRanges = (ranges: PageRange[]): Set<number> => {
  const pages = new Set<number>();
  for (const range of ranges || []) {
    const a = parsePageRef(range?.from);
    const b = parsePageRef(range?.to);
    if (a == null && b == null) continue;
    const start = Math.min(a ?? b!, b ?? a!);
    const end = Math.max(a ?? b!, b ?? a!);
    for (let p = start; p <= end; p++) {
      if (p >= 1 && p <= MUSHAF_TOTAL_PAGES) pages.add(p);
    }
  }
  return pages;
};

/**
 * Total memorized pages: the baseline plus every distinct page memorized beyond it.
 * Pages at or before the baseline position are already counted in `baseline.pages`.
 */
export const computeTotalMemorizedPages = (
  baseline: MemorizedBaseline,
  ranges: PageRange[],
): number => {
  const base = Math.max(0, Math.min(MUSHAF_TOTAL_PAGES, baseline?.pages ?? 0));
  const upTo = baseline?.upToPage ?? null;
  const beyond = [...pageSetFromRanges(ranges)].filter((p) => upTo == null || p > upTo);
  return Math.min(MUSHAF_TOTAL_PAGES, base + beyond.length);
};

/** Percentage of the mushaf memorized. */
export const memorizedPercent = (pages: number | null | undefined): number => {
  const p = Math.max(0, Math.min(MUSHAF_TOTAL_PAGES, Number(pages) || 0));
  return Math.round((p / MUSHAF_TOTAL_PAGES) * 100);
};

/** Approximate juz equivalent of a page count, for staff who think in أجزاء. */
export const juzEquivalent = (pages: number | null | undefined): number => {
  const p = Math.max(0, Math.min(MUSHAF_TOTAL_PAGES, Number(pages) || 0));
  if (p === 0) return 0;
  return Math.round((p / MUSHAF_TOTAL_PAGES) * 30 * 10) / 10;
};

/** Pages in a juz range, for entering a baseline as "from juz X to juz Y". */
export const pagesForJuzRange = (juzFrom: number, juzTo: number): number =>
  juzRangeToPageBounds(juzFrom, juzTo)?.total ?? 0;

/** Last page of a juz range — the baseline position that goes with the count. */
export const lastPageOfJuzRange = (juzFrom: number, juzTo: number): number | null =>
  juzRangeToPageBounds(juzFrom, juzTo)?.end ?? null;

const ARABIC_DIGITS = /[٠-٩]/g;
const toWesternDigits = (s: string) =>
  s.replace(ARABIC_DIGITS, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));

/**
 * Best-effort reading of the free-text `memorization_amount` captured at enrolment,
 * e.g. "5 أجزاء", "جزء عم", "نصف القرآن". Returns pages, or null when it cannot tell.
 *
 * Never apply this automatically — it is a suggestion for a human to confirm.
 */
export const parseLegacyMemorizationAmount = (text?: string | null): number | null => {
  const raw = toWesternDigits(String(text ?? "").trim());
  if (!raw) return null;

  const pagesPerJuz = MUSHAF_TOTAL_PAGES / 30;
  const fromJuz = (juz: number) => Math.round(juz * pagesPerJuz);

  if (/كامل|كل القرآن|ختم|خاتم/.test(raw)) return MUSHAF_TOTAL_PAGES;
  if (/نصف/.test(raw)) return Math.round(MUSHAF_TOTAL_PAGES / 2);
  if (/ربع/.test(raw)) return Math.round(MUSHAF_TOTAL_PAGES / 4);
  if (/ثلث/.test(raw)) return Math.round(MUSHAF_TOTAL_PAGES / 3);
  // جزء عم is the 30th juz. `\b` is useless here — Arabic letters are not \w — so
  // match "عم" only as a standalone word.
  if (/(^|\s)عمّ?($|\s)/.test(raw)) return MUSHAF_TOTAL_PAGES - JUZ_START_PAGE[29] + 1;
  if (/تبارك/.test(raw)) return JUZ_START_PAGE[29] - JUZ_START_PAGE[28];
  if (/لا شيء|لا يوجد|مبتدئ|بدون/.test(raw)) return 0;

  const num = raw.match(/\d+(?:\.\d+)?/);
  if (!num) return null;
  const value = parseFloat(num[0]);
  if (!Number.isFinite(value) || value < 0) return null;

  if (/جزء|أجزاء|اجزاء/.test(raw)) return Math.min(MUSHAF_TOTAL_PAGES, fromJuz(value));
  if (/صفح/.test(raw)) return Math.min(MUSHAF_TOTAL_PAGES, Math.round(value));
  if (/وجه|أوجه|اوجه/.test(raw)) return Math.min(MUSHAF_TOTAL_PAGES, Math.round(value / 2));
  if (/سور/.test(raw)) return null; // surah counts do not map to pages

  // A bare number is conventionally a juz count in this context.
  return value <= 30 ? fromJuz(value) : Math.min(MUSHAF_TOTAL_PAGES, Math.round(value));
};
