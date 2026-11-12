export type MemorizationRange = { start: number; end: number };

/** Merge inclusive ranges; overlapping and adjacent evidence is counted once. */
export function mergeMemorizationRanges(ranges: MemorizationRange[]) {
  const sorted = ranges.filter(r => Number.isInteger(r.start) && Number.isInteger(r.end) && r.start > 0 && r.end >= r.start).sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: MemorizationRange[] = [];
  for (const r of sorted) {
    const last = merged.at(-1);
    if (last && r.start <= last.end + 1) last.end = Math.max(last.end, r.end);
    else merged.push({ ...r });
  }
  return merged;
}

/** A hizb is complete only when evidence covers every ayah; partial evidence is reported separately. */
export function hizbCoverage(ranges: MemorizationRange[], starts: number[]) {
  const merged = mergeMemorizationRanges(ranges);
  const completed: number[] = [], partial: number[] = [];
  for (let h = 1; h <= 60; h++) {
    const start = starts[h - 1], end = starts[h] - 1;
    if (merged.some(r => r.start <= start && r.end >= end)) completed.push(h);
    else if (merged.some(r => r.start <= end && r.end >= start)) partial.push(h);
  }
  return { completed, partial };
}
