import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export interface HimmahDay { id: string; title: string; day_date: string; error_weight: number; fail_threshold: number; ranking_mode: 'passed' | 'completion'; registration_open: boolean; expires_at: string; invite_key?: string; manager_name: string; logo_url: string; association_logo_url: string; stamp_url: string }
export interface Participant { id: string; student_id: string; student_name: string; halaqa_id: string; halaqa_name: string; teacher_name: string; hizbs: number[]; present: boolean }
export interface Reviewer { id: string; full_name: string; phone: string; active: boolean }
export interface Attempt { id: string; participant_id: string; reviewer_id: string; hizb: number; attempt_no: number; started_at: string; ended_at: string | null; duration_seconds: number | null; mistakes: number; warnings: number; equivalent_errors: number | null; error_weight: number | null; fail_threshold: number | null; status: 'running' | 'ended' | 'pass' | 'fail'; approved_at: string | null }
export interface Dashboard { day: HimmahDay; can_manage: boolean; reviewer_id: string | null; participants: Participant[]; reviewers: Reviewer[]; attempts: Attempt[]; audit: { id: string; action: string; created_at: string }[] }
export const outcome = (mistakes: number, warnings: number, weight = 4, threshold = 12) => {
  if (![mistakes, warnings, weight, threshold].every(Number.isSafeInteger) || mistakes < 0 || warnings < 0 || weight < 1 || threshold < 1) throw new Error('أعداد غير صحيحة');
  return mistakes * weight + warnings >= threshold ? 'fail' : 'pass';
};
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
export const appreciation = (percent: number) => percent >= 90 ? 'ممتاز' : percent >= 80 ? 'جيد جدًا' : percent >= 70 ? 'جيد' : percent >= 60 ? 'مقبول' : 'يحتاج تحسينًا';
export const duration = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`;
export function summarize(participants: Participant[], attempts: Attempt[], mode: HimmahDay['ranking_mode'] = 'passed') {
  const latest = latestApproved(attempts);
  const rows = participants.map(p => {
    const results = latest.filter(a => a.participant_id === p.id && p.hizbs.includes(a.hizb));
    const passed = results.filter(a => a.status === 'pass');
    const completion = p.hizbs.length ? passed.length / p.hizbs.length * 100 : 0;
    return { ...p, results, passed, completion, average: results.length ? results.reduce((s, a) => s + (a.equivalent_errors || 0), 0) / results.length : Infinity, rank: 0 };
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