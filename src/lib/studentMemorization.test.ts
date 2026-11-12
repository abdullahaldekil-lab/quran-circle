import { describe, expect, it } from 'vitest';
import { hizbCoverage, mergeMemorizationRanges } from './studentMemorization';

const starts = Array.from({ length: 61 }, (_, i) => i * 100 + 1);

describe('verified hizb coverage', () => {
  it('suggests only the complete hizb when the student has one and a half', () => {
    expect(hizbCoverage([{ start: 1, end: 150 }], starts)).toEqual({ completed: [1], partial: [2] });
  });
  it('does not infer memorization from an empty plan target', () => {
    expect(hizbCoverage([], starts).completed).toEqual([]);
  });
  it('keeps correct hizb numbers at the end of the mushaf', () => {
    expect(hizbCoverage([{ start: 5901, end: 6000 }], starts).completed).toEqual([60]);
  });
  it('deduplicates overlapping ranges and joins adjacent evidence', () => {
    expect(mergeMemorizationRanges([{ start: 1, end: 80 }, { start: 40, end: 100 }, { start: 101, end: 120 }])).toEqual([{ start: 1, end: 120 }]);
    expect(hizbCoverage([{ start: 1, end: 60 }, { start: 61, end: 100 }], starts).completed).toEqual([1]);
  });
  it('rejects a complete hizb when any internal gap remains', () => {
    expect(hizbCoverage([{ start: 1, end: 49 }, { start: 51, end: 100 }], starts)).toEqual({ completed: [], partial: [1] });
  });
});
