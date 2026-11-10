import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export interface HimmahDay { id: string; title: string; day_date: string; error_weight: number; fail_threshold: number; ranking_mode: 'passed' | 'completion'; registration_open: boolean; expires_at: string; invite_key?: string; manager_name: string; logo_url: string; association_logo_url: string; stamp_url: string; grade_bounds?: GradeBounds; total_score: number; mistake_deduction: number; warning_deduction: number; pass_score: number; time_limit_seconds: number }
export interface Participant { id: string; student_id: string; student_name: string; halaqa_id: string; halaqa_name: string; teacher_name: string; hizbs: number[]; present: boolean }
export interface Reviewer { id: string; full_name: string; phone: string; active: boolean }
export interface Attempt { id: string; participant_id: string; reviewer_id: string; hizb: number; attempt_no: number; started_at: string; ended_at: string | null; duration_seconds: number | null; mistakes: number; warnings: number; equivalent_errors: number | null; error_weight: number | null; fail_threshold: number | null; status: 'running' | 'ended' | 'pass' | 'fail'; approved_at: string | null; score?: number | null; scoring?: ScoringConfig & { reviewer_name?: string } | null }
export interface Dashboard { day: HimmahDay; can_manage: boolean; reviewer_id: string | null; participants: Participant[]; reviewers: Reviewer[]; attempts: Attempt[]; audit: { id: string; action: string; created_at: string }[] }
export interface ScoringConfig { total_score: number; mistake_deduction: number; warning_deduction: number; pass_score: number; time_limit_seconds?: number }
/** Final score = total − mistakes×mistake deduction − warnings×warning deduction, clamped to [0, total]. No automatic fail by count or time. */
export const score = (mistakes: number, warnings: number, c: ScoringConfig) => {
  if (![mistakes, warnings].every(Number.isSafeInteger) || mistakes < 0 || warnings < 0 || ![c.total_score, c.mistake_deduction, c.warning_deduction, c.pass_score].every(Number.isFinite) || c.total_score <= 0) throw new Error('أعداد غير صحيحة');
  return Math.max(0, Math.min(c.total_score, c.total_score - mistakes * c.mistake_deduction - warnings * c.warning_deduction));
};
export const outcome = (mistakes: number, warnings: number, c: ScoringConfig) => score(mistakes, warnings, c) >= c.pass_score ? 'pass' : 'fail';
/** Score of an approved attempt from its saved snapshot (legacy attempts have none). */
export const attemptScore = (a: Attempt) => a.score ?? null;
export function latestApproved(attempts: Attempt[]) {
  const map = new Map<string, Attempt>();
  for (const a of attempts) {
    if (!a.approved_at) continue;
    const key = `${a.participant_id}:${a.hizb}`;
    const previous = map.get(key);
    if (!previous || Date.parse(a.approved_at) > Date.parse(previous.approved_at || '')) map.set(key, a);
  }
  return [...map.values()];
}
export interface GradeBounds { excellent: number; very_good: number; good: number; acceptable: number }
export const DEFAULT_GRADE_BOUNDS: GradeBounds = { excellent: 90, very_good: 80, good: 70, acceptable: 60 };
export const validBounds = (b: GradeBounds) => [b.excellent, b.very_good, b.good, b.acceptable].every(Number.isFinite) && b.excellent <= 100 && b.excellent > b.very_good && b.very_good > b.good && b.good > b.acceptable && b.acceptable >= 0;
export const appreciation = (percent: number, b: GradeBounds = DEFAULT_GRADE_BOUNDS) => { const g = validBounds(b) ? b : DEFAULT_GRADE_BOUNDS; return percent >= g.excellent ? 'ممتاز' : percent >= g.very_good ? 'جيد جدًا' : percent >= g.good ? 'جيد' : percent >= g.acceptable ? 'مقبول' : 'يحتاج تحسينًا'; };
/** Aggregate indicators for an already-filtered set of summarized rows (unique hizbs via latest approved attempt). */
export function stats(rows: ReturnType<typeof summarize>) {
  const total = rows.reduce((s, p) => s + p.hizbs.length, 0); const passed = rows.reduce((s, p) => s + p.passed.length, 0); const presented = rows.reduce((s, p) => s + p.results.length, 0); const present = rows.filter(p => p.present).length;
  return { registered: rows.length, present, attendance: rows.length ? present / rows.length * 100 : 0, total, presented, passed, failed: presented - passed, notPresented: total - presented, remaining: total - passed, completion: total ? passed / total * 100 : 0 };
}
/** Keep the selected certificate bound to a student id; fall back to the first match when it leaves the list. */
export function certificateIndex(ids: string[], selected: string | null) { if (!ids.length) return -1; const i = selected ? ids.indexOf(selected) : -1; return i >= 0 ? i : 0; }
export const duration = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
export function summarize(participants: Participant[], attempts: Attempt[], mode: HimmahDay['ranking_mode'] = 'passed') {
  const latest = latestApproved(attempts);
  const rows = participants.map(p => {
    const results = latest.filter(a => a.participant_id === p.id && p.hizbs.includes(a.hizb));
    const passed = results.filter(a => a.status === 'pass');
    const completion = p.hizbs.length ? passed.length / p.hizbs.length * 100 : 0;
    return { ...p, results, passed, completion, average: results.length ? -results.reduce((s, a) => s + (a.score ?? 0), 0) / results.length : Infinity, avgScore: results.length ? results.reduce((s, a) => s + (a.score ?? 0), 0) / results.length : 0, rank: 0 };
  }).sort((a, b) => (mode === 'completion' ? b.completion - a.completion : b.passed.length - a.passed.length) || a.average - b.average);
  rows.forEach((r, i) => {
    const previous = rows[i - 1];
    r.rank = previous && (mode === 'completion' ? previous.completion === r.completion : previous.passed.length === r.passed.length) && previous.average === r.average ? previous.rank : i + 1;
  });
  return rows;
}
export async function dashboard(day: string, token?: string) {
  const { data, error } = await supabase.rpc('himmah_dashboard', { _day: day, _token: token || undefined });
  if (error) throw error;
  return data as unknown as Dashboard;
}
export async function manage(action: string, day: string | undefined, payload: Record<string, Json | undefined>) {
  const { data, error } = await supabase.rpc('himmah_manage', { _action: action, _day: day, _data: payload });
  if (error) throw error;
  return data;
}
export async function attemptAction(action: string, day: string, options: { participant?: string; hizb?: number; attempt?: string; request?: string; mistakes?: number; warnings?: number; token?: string }) {
  const { data, error } = await supabase.rpc('himmah_attempt', { _action: action, _day: day, _participant: options.participant, _hizb: options.hizb, _attempt: options.attempt, _request: options.request, _mistakes: options.mistakes ?? 0, _warnings: options.warnings ?? 0, _token: options.token });
  if (error) throw error;
  return data as unknown as Attempt;
}
export function randomToken() { return [...crypto.getRandomValues(new Uint8Array(32))].map(v => v.toString(16).padStart(2, '0')).join(''); }