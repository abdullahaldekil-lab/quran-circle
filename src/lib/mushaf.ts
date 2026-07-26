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
