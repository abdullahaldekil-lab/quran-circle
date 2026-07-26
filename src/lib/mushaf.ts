// Madinah mushaf (Hafs, 604 pages) helpers — mapping juz ranges to real page
// numbers so plans are distributed in mushaf order (from → to).

export const MUSHAF_TOTAL_PAGES = 604;

/** First page of each juz (1-based) in the standard Madinah mushaf. */
export const JUZ_START_PAGE: number[] = [
  1, 22, 42, 62, 82, 102, 121, 142, 162, 182,
  201, 222, 242, 262, 282, 302, 322, 342, 362, 382,
  402, 422, 442, 462, 482, 502, 522, 542, 562, 582,
];

const clampJuz = (n: number) => Math.max(1, Math.min(30, Math.round(n || 0)));

/** Inclusive page bounds of a juz range in mushaf order. */
export const juzRangeToPageBounds = (
  juzFrom?: number | null,
  juzTo?: number | null,
): { start: number; end: number; total: number } | null => {
  if (!juzFrom || !juzTo) return null;
  const f = clampJuz(juzFrom);
  const t = clampJuz(juzTo);
  if (t < f) return null;
  const start = JUZ_START_PAGE[f - 1];
  const end = t >= 30 ? MUSHAF_TOTAL_PAGES : JUZ_START_PAGE[t] - 1;
  return { start, end, total: end - start + 1 };
};

/** Which juz a given mushaf page belongs to. */
export const pageToJuz = (page: number): number => {
  let juz = 1;
  for (let i = 0; i < JUZ_START_PAGE.length; i++) if (page >= JUZ_START_PAGE[i]) juz = i + 1;
  return juz;
};

/** Page image (Madinah mushaf scans, King Saud University). */
export const mushafPageImage = (page: number): string =>
  `https://quran.ksu.edu.sa/png_big/${Math.max(1, Math.min(MUSHAF_TOTAL_PAGES, Math.round(page)))}.png`;

export const formatPageRange = (from?: number | null, to?: number | null): string =>
  from && to ? (from === to ? `صفحة ${from}` : `${from} – ${to}`) : "—";

/** Extract a mushaf page number from a free-text reference such as "صفحة 42 (الجزء 3)". */
export const parsePageRef = (text?: string | null): number | null => {
  const m = String(text ?? "").match(/\d+/);
  if (!m) return null;
  const n = parseInt(m[0], 10);
  return Number.isFinite(n) && n >= 1 && n <= MUSHAF_TOTAL_PAGES ? n : null;
};

/** Human label of a page including its juz, e.g. "صفحة 42 (الجزء 3)". */
export const formatPageRef = (page: number): string =>
  `صفحة ${page} (الجزء ${pageToJuz(page)})`;

export interface DailyMushafRange {
  from: number;
  to: number;
  juzFrom: number;
  juzTo: number;
  fromLabel: string;
  toLabel: string;
  /** true when the student already reached the end of the plan range. */
  completed: boolean;
}

/**
 * Next daily range in mushaf order, derived from the student's last memorized
 * page. `dailyPages` is in "أوجه" (half pages): 2 أوجه = صفحة كاملة.
 */
export const nextDailyMushafRange = (
  lastMemorizedTo: string | null | undefined,
  dailyPages: number,
  bounds?: { start: number; end: number } | null,
): DailyMushafRange => {
  const startBound = bounds?.start ?? 1;
  const endBound = bounds?.end ?? MUSHAF_TOTAL_PAGES;
  const last = parsePageRef(lastMemorizedTo);
  const from = Math.min(endBound, Math.max(startBound, last != null ? last + 1 : startBound));
  const step = Math.max(1, Math.ceil((Number(dailyPages) || 1) / 2));
  const to = Math.min(endBound, from + step - 1);
  return {
    from,
    to,
    juzFrom: pageToJuz(from),
    juzTo: pageToJuz(to),
    fromLabel: formatPageRef(from),
    toLabel: formatPageRef(to),
    completed: last != null && last >= endBound,
  };
};
