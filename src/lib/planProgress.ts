// Crediting a student's annual/term plan with what was ACTUALLY recited.
//
// Both the recitation page and the plan page used to add the *planned* daily figure
// (`daily_memorization_pages`) on every save, regardless of what the student recited.
// A student who recited half a page got full credit; one who recited three got one.
// Everything here works from the recorded ranges instead.

import { parsePageRef } from "./mushaf";

export interface RecitedRanges {
  memorized_from?: string | null;
  memorized_to?: string | null;
  review_from?: string | null;
  review_to?: string | null;
  linking_from?: string | null;
  linking_to?: string | null;
}

export interface ActualPages {
  mem: number;
  rev: number;
  link: number;
  total: number;
}

/**
 * Pages covered by one range, inclusive.
 *
 * Ranges are free text. When a bound cannot be read as a mushaf page — older records
 * hold values like "البقرة 5" — but the section was filled in, it counts as a single
 * page rather than zero, so legacy data still contributes something. A reversed range
 * counts as 0, never negative.
 */
export const pagesInRange = (from?: string | null, to?: string | null): number => {
  const hasFrom = !!String(from ?? "").trim();
  const hasTo = !!String(to ?? "").trim();
  if (!hasFrom && !hasTo) return 0;

  const a = parsePageRef(from);
  const b = parsePageRef(to);
  if (a == null || b == null) return 1; // filled in, but not parseable as pages
  if (b < a) return 0;
  return b - a + 1;
};

/** Pages actually covered by one recitation record, split by section. */
export const actualPagesFromRecord = (r: RecitedRanges): ActualPages => {
  const mem = pagesInRange(r.memorized_from, r.memorized_to);
  const rev = pagesInRange(r.review_from, r.review_to);
  const link = pagesInRange(r.linking_from, r.linking_to);
  return { mem, rev, link, total: mem + rev + link };
};

/**
 * 1-based month of the plan a date falls in. Month 1 is the plan's start month.
 * Dates before the plan start clamp to 1.
 */
export const monthNumberFor = (planStartISO: string, recordISO: string): number => {
  const start = new Date(planStartISO);
  const date = new Date(recordISO);
  if (Number.isNaN(start.getTime()) || Number.isNaN(date.getTime())) return 1;
  const diff =
    (date.getFullYear() - start.getFullYear()) * 12 + (date.getMonth() - start.getMonth());
  return Math.max(1, diff + 1);
};

/** Sum the actual pages of many records into per-month buckets. */
export const aggregateActuals = (
  records: (RecitedRanges & { record_date: string })[],
  planStartISO: string,
): Record<number, ActualPages> => {
  const buckets: Record<number, ActualPages> = {};
  for (const record of records) {
    const month = monthNumberFor(planStartISO, record.record_date);
    const pages = actualPagesFromRecord(record);
    const bucket = buckets[month] || { mem: 0, rev: 0, link: 0, total: 0 };
    buckets[month] = {
      mem: bucket.mem + pages.mem,
      rev: bucket.rev + pages.rev,
      link: bucket.link + pages.link,
      total: bucket.total + pages.total,
    };
  }
  return buckets;
};

/** Commitment percentage, capped at 100 and safe when nothing was targeted. */
export const commitmentPercentage = (actual: number, target: number): number => {
  if (!target || target <= 0) return 0;
  return Math.min(100, Math.round((actual / target) * 100));
};

export type ProgressStatus = "ahead" | "on_track" | "behind";

/** Matches the `status` values stored on student_plan_progress. */
export const progressStatus = (pct: number): ProgressStatus => {
  if (pct >= 100) return "ahead";
  if (pct >= 70) return "on_track";
  return "behind";
};
