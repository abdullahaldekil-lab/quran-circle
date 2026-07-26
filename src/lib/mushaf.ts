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
  const step = pagesStep(dailyPages);
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

/** أوجه → صفحات (2 أوجه = صفحة). Always at least one page. */
export const pagesStep = (dailyPages: number): number =>
  Math.max(1, Math.ceil((Number(dailyPages) || 1) / 2));

const buildRange = (from: number, to: number, completed = false): DailyMushafRange => ({
  from,
  to,
  juzFrom: pageToJuz(from),
  juzTo: pageToJuz(to),
  fromLabel: formatPageRef(from),
  toLabel: formatPageRef(to),
  completed,
});

export interface ReviewMushafRange extends DailyMushafRange {
  /** true when the sweep reached the end of the memorized portion and restarted. */
  wrapped: boolean;
}

/**
 * Next review (مراجعة) range. Review sweeps forward through what the student has
 * already memorized and wraps back to the beginning once it reaches the end, so the
 * whole memorized portion keeps circulating.
 *
 * `memorized` is the portion available to review — from the start of the student's
 * plan to the last page they have memorized.
 */
export const nextReviewMushafRange = (
  lastReviewTo: string | null | undefined,
  dailyReviewPages: number,
  memorized: { start: number; end: number },
): ReviewMushafRange | null => {
  const start = Math.max(1, memorized.start);
  const end = Math.min(MUSHAF_TOTAL_PAGES, memorized.end);
  if (end < start) return null; // nothing memorized yet — nothing to review

  const step = pagesStep(dailyReviewPages);
  const last = parsePageRef(lastReviewTo);

  let from: number;
  let wrapped = false;
  if (last == null || last >= end || last < start) {
    from = start;
    wrapped = last != null && last >= end;
  } else {
    from = last + 1;
  }

  const to = Math.min(end, from + step - 1);
  return { ...buildRange(from, to), wrapped };
};

/**
 * Next linking (الربط) range. Linking joins the end of what came before to today's
 * new memorization, so it is the pages immediately preceding today's new portion.
 */
export const nextLinkingMushafRange = (
  todayMemorizedFrom: number | null | undefined,
  dailyLinkingPages: number,
  bounds?: { start: number; end: number } | null,
): DailyMushafRange | null => {
  const startBound = Math.max(1, bounds?.start ?? 1);
  if (todayMemorizedFrom == null) return null;

  const step = pagesStep(dailyLinkingPages);
  const to = todayMemorizedFrom - 1;
  if (to < startBound) return null; // today's portion is the very beginning

  const from = Math.max(startBound, to - step + 1);
  return buildRange(from, to);
};
