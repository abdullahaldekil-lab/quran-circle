import { describe, expect, it } from 'vitest';
import { certificateIndex, stats, appreciation, duration, latestApproved, outcome, summarize, type Attempt, type Participant } from './himmah';
describe('Himmah rules', () => {
  it.each([[3, 0, 'fail'], [0, 12, 'fail'], [1, 8, 'fail'], [2, 4, 'fail'], [2, 9, 'fail'], [2, 3, 'pass']])('%i errors and %i warnings => %s', (e, w, result) => expect(outcome(Number(e), Number(w))).toBe(result));
  it('rejects negative and fractional input', () => { expect(() => outcome(-1, 0)).toThrow(); expect(() => outcome(0.5, 0)).toThrow(); });
  it.each([[90, 'ممتاز'], [80, 'جيد جدًا'], [70, 'جيد'], [60, 'مقبول'], [59, 'يحتاج تحسينًا']])('grade boundary %i', (n, grade) => expect(appreciation(Number(n))).toBe(grade));
  it('keeps duration after finishing', () => expect(duration(125)).toBe('02:05'));
  const p: Participant = { id: 'p', student_id: 's', student_name: 'student', halaqa_id: 'h', halaqa_name: 'circle', teacher_name: '', hizbs: [1, 2], present: true };
  const a = (id: string, approved_at: string, status: 'pass' | 'fail'): Attempt => ({ id, participant_id: 'p', reviewer_id: 'r', hizb: 1, attempt_no: 1, started_at: approved_at, ended_at: approved_at, duration_seconds: 30, mistakes: 2, warnings: 3, equivalent_errors: 11, error_weight: 4, fail_threshold: 12, status, approved_at });
  it('counts latest approved hizb only, not multiple attempts', () => { const attempts = [a('a', '2026-11-10T01:00:00Z', 'fail'), a('b', '2026-11-10T02:00:00Z', 'pass')]; expect(latestApproved(attempts).map(x => x.id)).toEqual(['b']); expect(summarize([p], attempts)[0].completion).toBe(50); });
  it('preserves approved result when settings change', () => { const saved = a('a', '2026-11-10T01:00:00Z', 'pass'); expect(outcome(2, 3, 5, 12)).toBe('fail'); expect(latestApproved([saved])[0].status).toBe('pass'); });
  it('ties receive equal ranks', () => { const rows = summarize([p, { ...p, id: 'p2' }], [a('a', '2026-11-10T01:00:00Z', 'pass'), { ...a('b', '2026-11-10T01:00:00Z', 'pass'), participant_id: 'p2' }]); expect(rows.map(x => x.rank)).toEqual([1, 1]); });
  it('custom grade bounds change the grade', () => { expect(appreciation(85, { excellent: 85, very_good: 75, good: 65, acceptable: 50 })).toBe('ممتاز'); expect(appreciation(85)).toBe('جيد جدًا'); });
  it('stats follow the filtered scope only', () => { const rows = summarize([p, { ...p, id: 'p2', halaqa_id: 'h2', present: false }], [a('a', '2026-11-10T01:00:00Z', 'pass')]); const one = stats(rows.filter(r => r.halaqa_id === 'h')); expect(one.registered).toBe(1); expect(one.passed).toBe(1); expect(one.remaining).toBe(1); expect(stats(rows).total).toBe(4); });
  it('certificate stays visible after filtering to one student', () => { expect(certificateIndex(['x'], 'y')).toBe(0); expect(certificateIndex(['x', 'y'], 'y')).toBe(1); expect(certificateIndex([], 'y')).toBe(-1); });
});
