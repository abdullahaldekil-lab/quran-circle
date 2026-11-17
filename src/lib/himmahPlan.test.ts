import { describe, expect, it } from 'vitest';
import { planChanges } from './himmahPlan';
import { outcome, score, approvedExplanation, type Participant } from './himmah';
const p: Participant = { id: 'p', student_id: 'old', student_name: 'old', halaqa_id: 'h', halaqa_name: 'h', teacher_name: '', hizbs: [55, 56], present: false };
describe('Himmah plan changes', () => {
 it('does not resend unchanged historical plans when another student changes', () => expect(planChanges({ old: { on: true, hizbs: [56,55] }, next: { on: true, hizbs: [57,60] } }, [p], ['h'])).toEqual({ plan: [{ student_id: 'next', hizbs: [57,60] }], remove: [] }));
 it('sends edited hizbs 55–60 only', () => expect(planChanges({ old: { on: true, hizbs: [55,56,60] } }, [p], ['h']).plan).toEqual([{ student_id: 'old', hizbs: [55,56,60] }]));
 it('sends an empty changed plan to the server for rejection rather than silently skipping it', () => expect(planChanges({ old: { on: true, hizbs: [] } }, [p], ['h']).plan[0].hizbs).toEqual([]));
 it('removes explicitly unchecked students without duplicate updates', () => expect(planChanges({ old: { on: false, hizbs: [55,56] } }, [p], ['h'])).toEqual({ plan: [], remove: ['old'] }));
 it('excludes edits of participants from removed circles', () => expect(planChanges({ old: { on: true, hizbs: [60] } }, [p], []).plan).toEqual([]));
});
describe('Actual scoring thresholds', () => {
 const cfg = { total_score: 100, mistake_deduction: 4, melody_deduction: 4, warning_deduction: 1, pass_score: 80 };
 it('two errors and five warnings score 87 and pass at 80', () => { expect(score(2,5,cfg,0)).toBe(87); expect(outcome(2,5,cfg,0)).toBe('pass'); });
 it('87 fails at 90', () => expect(outcome(2,5,{ ...cfg, pass_score: 90 },0)).toBe('fail'));
 it('87 passes at equality', () => expect(outcome(2,5,{ ...cfg, pass_score: 87 },0)).toBe('pass'));
 it('approved score and threshold use the original snapshot', () => { const a = { score:87, scoring:{...cfg,pass_score:89} }; expect(approvedExplanation(a)).toContain('حد النجاح 89'); expect(a.score).toBe(87); });
});
