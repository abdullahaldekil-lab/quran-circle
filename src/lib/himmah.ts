import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export interface HimmahDay { id: string; title: string; day_date: string; error_weight: number; fail_threshold: number; ranking_mode: 'passed' | 'completion'; registration_open: boolean; expires_at: string; invite_key?: string; display_key?: string; manager_name: string; logo_url: string; association_logo_url: string; stamp_url: string; certificate_title: string; certificate_note: string; grade_bounds?: GradeBounds; total_score: number; mistake_deduction: number; melody_deduction: number; warning_deduction: number; pass_score: number; minimum_duration_seconds: number; time_limit_seconds?: number; pause_limit_seconds?: number; halaqa_ids?: string[] }
export interface Participant { id: string; student_id: string; student_name: string; halaqa_id: string; halaqa_name: string; teacher_name: string; hizbs: number[]; present: boolean; attended_at?: string | null; attended_by_name?: string | null }
export interface Reopening { participant_id: string; hizb: number; reopened_at: string }
export interface Reviewer { id: string; full_name: string; phone: string; active: boolean; status?: 'pending' | 'assigned' | 'revoked'; staff?: boolean; code_issued_at?: string | null }
export interface Assignment { reviewer_id: string; halaqa_id: string | null; participant_id: string | null }
export interface Attempt { id: string; participant_id: string; reviewer_id: string; hizb: number; attempt_no: number; started_at: string; ended_at: string | null; duration_seconds: number | null; mistakes: number; melodies: number; warnings: number; equivalent_errors: number | null; error_weight: number | null; fail_threshold: number | null; status: 'running' | 'ended' | 'pass' | 'fail' | 'cancelled'; approved_at: string | null; paused_at?: string | null; paused_seconds?: number; score?: number | null; scoring?: ScoringConfig & { reviewer_name?: string } | null }
export interface Dashboard { day: HimmahDay; can_manage: boolean; reviewer_id: string | null; participants: Participant[]; reviewers: Reviewer[]; assignments: Assignment[]; reopenings: Reopening[]; attempts: Attempt[]; audit: { id: string; action: string; created_at: string }[] }
export interface ScoringConfig { total_score: number; mistake_deduction: number; melody_deduction?: number; warning_deduction: number; pass_score: number; time_limit_seconds?: number; minimum_duration_seconds?: number; timing_rule?: string }
/** Final score = total − mistakes×mistake deduction − melodies×melody deduction − warnings×warning deduction. */
export const score = (mistakes: number, warnings: number, c: ScoringConfig, melodies = 0) => {
  if (![mistakes, melodies, warnings].every(Number.isSafeInteger) || mistakes < 0 || melodies < 0 || warnings < 0 || ![c.total_score, c.mistake_deduction, c.melody_deduction ?? 0, c.warning_deduction, c.pass_score].every(Number.isFinite) || c.total_score <= 0) throw new Error('أعداد غير صحيحة');
  return Math.max(0, Math.min(c.total_score, c.total_score - mistakes * c.mistake_deduction - melodies * (c.melody_deduction ?? 0) - warnings * c.warning_deduction));
};
export const outcome = (mistakes: number, warnings: number, c: ScoringConfig, melodies = 0) => score(mistakes, warnings, c, melodies) >= c.pass_score ? 'pass' : 'fail';
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
/** Approved hizbs disappear from the recitation choices; this count is what the student has not recited yet. */
export function remainingHizbs(participant: Participant, attempts: Attempt[], reopened: Reopening[] = []) {
  const reopenedSet = new Set(reopened.filter(r => r.participant_id === participant.id).map(r => r.hizb));
  const done = new Set(latestApproved(attempts).filter(a => a.participant_id === participant.id && !reopenedSet.has(a.hizb)).map(a => a.hizb));
  return participant.hizbs.filter(h => !done.has(h));
}
/** Per-reviewer latest result for each student/hizb, plus the separate approved-attempt count. */
export function reviewerStats(attempts: Attempt[], reviewerId: string) {
  const own = attempts.filter(a => a.reviewer_id === reviewerId && a.approved_at);
  const latest = new Map<string, Attempt>();
  for (const a of own) {
    const key = `${a.participant_id}:${a.hizb}`;
    const previous = latest.get(key);
    if (!previous || Date.parse(a.approved_at || '') > Date.parse(previous.approved_at || '')) latest.set(key, a);
  }
  const results = [...latest.values()];
  const passed = results.filter(a => a.status === 'pass').length;
  return { presented: results.length, passed, failed: results.length - passed, attempts: own.length };
}
export function countReviewerHizbs(attempts: Attempt[], reviewerId: string) { return reviewerStats(attempts, reviewerId).presented; }
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
/** Apply reviewer/status filters to the hizbs themselves before computing any card, table or export total. */
export function scopeRows(rows: ReturnType<typeof summarize>, reviewer = '', status = '') {
  return rows.map(p => {
    let allowed = p.hizbs;
    if (reviewer) allowed = allowed.filter(h => p.results.some(a => a.hizb === h && a.reviewer_id === reviewer));
    if (status === 'pending') allowed = allowed.filter(h => !p.results.some(a => a.hizb === h));
    else if (status) allowed = allowed.filter(h => p.results.some(a => a.hizb === h && a.status === status));
    const results = p.results.filter(a => allowed.includes(a.hizb)); const passed = results.filter(a => a.status === 'pass');
    return { ...p, hizbs: allowed, results, passed, completion: allowed.length ? passed.length / allowed.length * 100 : 0 };
  }).filter(p => p.hizbs.length > 0);
}
/** Difference between the server clock and this device, so the recitation timer never depends on the device time. */
let clockOffset = 0;
export const serverNow = () => Date.now() + clockOffset;
export function syncClock(serverIso: string | undefined, sentAt: number, receivedAt: number) {
  const server = Date.parse(serverIso || '');
  // A slow round trip is too imprecise to trust; keep the previous offset.
  if (Number.isFinite(server) && receivedAt - sentAt < 5000) clockOffset = server - (sentAt + receivedAt) / 2;
  return clockOffset;
}
export async function dashboard(day: string, token?: string) {
  const sentAt = Date.now();
  const { data, error } = await supabase.rpc('himmah_dashboard', { _day: day, _token: token || undefined });
  if (error) throw error;
  const { server_now, ...rest } = data as unknown as Dashboard & { server_now?: string };
  syncClock(server_now, sentAt, Date.now());
  return rest as Dashboard;
}
export type Branding = Pick<HimmahDay, 'logo_url' | 'association_logo_url' | 'stamp_url'>;
/** Certificate images are fetched once, outside the polled dashboard. */
export async function branding(day: string) {
  const { data, error } = await supabase.rpc('himmah_branding', { _day: day });
  if (error) throw error;
  return (data || { logo_url: '', association_logo_url: '', stamp_url: '' }) as unknown as Branding;
}
/** Only an explicit server refusal (bad or revoked code, expired day) ends a reviewer session; network failures do not. */
export const isAccessDenied = (error: unknown) => (error as { code?: string } | null)?.code === 'P0001';
export async function cancelAttempt(day: string, attempt: string, token?: string, reason?: string) {
  const { data, error } = await supabase.rpc('himmah_cancel_attempt', { _day: day, _attempt: attempt, _token: token, _reason: reason });
  if (error) throw error;
  return data as unknown as Attempt;
}
export async function savePlan(day: string, halaqaIds: string[], plan: { student_id: string; hizbs: number[] }[], remove: string[]) {
  const { data, error } = await supabase.rpc('himmah_save_plan', { _day: day, _halaqa_ids: halaqaIds, _plan: plan, _remove: remove });
  if (error) throw error;
  return data as unknown as { saved: number; removed: number };
}
/** Delay before retrying the automatic stop at the time limit: 2s, 4s, 8s … capped at 30s. */
export const retryDelay = (failures: number) => Math.min(30000, 2000 * 2 ** Math.max(0, failures - 1));
/** `datetime-local` works in device time; these keep the stored instant unchanged in both directions. */
export function toLocalInput(iso: string) { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
export function fromLocalInput(value: string) { const d = new Date(value); return Number.isNaN(d.getTime()) ? null : d.toISOString(); }
export const attemptStatusLabel = (s: Attempt['status']) => ({ pass: 'مجتاز', fail: 'راسب', cancelled: 'ملغاة', ended: 'بانتظار الاعتماد', running: 'قيد التسميع' })[s];
export async function manage(action: string, day: string | undefined, payload: Record<string, Json | undefined>) {
  const { data, error } = await supabase.rpc('himmah_manage', { _action: action, _day: day, _data: payload });
  if (error) throw error;
  return data;
}
export async function attemptAction(action: string, day: string, options: { participant?: string; hizb?: number; attempt?: string; request?: string; mistakes?: number; melodies?: number; warnings?: number; token?: string }) {
  const { data, error } = await supabase.rpc('himmah_attempt_v2', { _action: action, _day: day, _participant: options.participant, _hizb: options.hizb, _attempt: options.attempt, _request: options.request, _mistakes: options.mistakes ?? 0, _melodies: options.melodies ?? 0, _warnings: options.warnings ?? 0, _token: options.token });
  if (error) throw error;
  return data as unknown as Attempt;
}
export function randomToken() { return [...crypto.getRandomValues(new Uint8Array(32))].map(v => v.toString(16).padStart(2, '0')).join(''); }
export const reviewerStatusLabel = (r: Reviewer) => !r.active || r.status === 'revoked' ? 'موقوف' : r.code_issued_at ? 'صدر الكود' : 'بانتظار إصدار الكود';
export const codeMessage = (name: string, day: string, code: string, link: string) => `السلام عليكم ${name}\nتم اعتمادكم للتسميع في «${day}».\nكود الدخول: ${code}\nرابط الدخول: ${link}\nبعد الدخول اختر الحلقة ثم اسم الطالب. الكود خاص بكم ولا يُشارك.`;
/** Seconds of the current pause excluded from the clock; with a pause cap, time beyond it counts as recitation again. */
function pauseCredit(a: Pick<Attempt, 'paused_at' | 'paused_seconds'>, now: number, pauseLimit: number) {
  if (!a.paused_at) return 0;
  const current = Math.max(0, Math.floor((now - Date.parse(a.paused_at)) / 1000));
  return pauseLimit > 0 ? Math.min(current, Math.max(0, pauseLimit - (a.paused_seconds || 0))) : current;
}
/** Actual recitation seconds excluding allowed pauses; the minimum never caps elapsed time. */
export function elapsedSeconds(a: Pick<Attempt, 'started_at' | 'paused_at' | 'paused_seconds' | 'duration_seconds'>, now: number, _minimum: number, pauseLimit = 0) {
  if (a.duration_seconds != null) return a.duration_seconds;
  return Math.max(0, Math.floor((now - Date.parse(a.started_at)) / 1000) - (a.paused_seconds || 0) - pauseCredit(a, now, pauseLimit));
}
/** Pause seconds still available for an attempt, or null when pausing is unlimited. */
export function pauseRemaining(a: Pick<Attempt, 'paused_at' | 'paused_seconds'>, now: number, pauseLimit: number) {
  return pauseLimit > 0 ? Math.max(0, pauseLimit - (a.paused_seconds || 0) - pauseCredit(a, now, pauseLimit)) : null;
}
const arabicDigits = (s: string) => s.replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
/** Parses a hizb list such as "1-5، 8، 10-12" (Arabic or Latin digits) into sorted unique numbers; null when invalid or empty. */
export function parseHizbs(text: string) {
  const parts = arabicDigits(text).split(/[,،;\s]+/).filter(Boolean);
  const set = new Set<number>();
  for (const part of parts) {
    const m = /^(\d{1,2})(?:[-–](\d{1,2}))?$/.exec(part);
    if (!m) return null;
    const from = Number(m[1]), to = Number(m[2] ?? m[1]);
    if (from < 1 || to > 60 || from > to) return null;
    for (let h = from; h <= to; h++) set.add(h);
  }
  return set.size ? [...set].sort((a, b) => a - b) : null;
}
/** Compact text for a hizb list: [1,2,3,7] => "1-3، 7". */
export function formatHizbs(hizbs: number[]) {
  const sorted = [...new Set(hizbs)].sort((a, b) => a - b); const out: string[] = [];
  for (let i = 0; i < sorted.length; i++) { let j = i; while (j + 1 < sorted.length && sorted[j + 1] === sorted[j] + 1) j++; out.push(j > i ? `${sorted[i]}-${sorted[j]}` : String(sorted[i])); i = j; }
  return out.join('، ');
}
/** Search key that ignores diacritics and common Arabic letter variants. */
export const normalizeArabic = (s: string) => s.replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/\s+/g, ' ').trim().toLowerCase();
/** Today's date in the device time zone as YYYY-MM-DD (not the UTC date). */
export function localDate(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
/** Places report blocks down the pages: a block that does not fit moves to the next page, and only a block taller than a page is split. */
export function createFlow(pageHeight: number) {
  let page = 0, y = 0;
  return { place(height: number) {
    const pieces: { page: number; y: number; offset: number; height: number }[] = [];
    if (height <= pageHeight) { if (y > 0 && y + height > pageHeight) { page++; y = 0; } pieces.push({ page, y, offset: 0, height }); y += height; return pieces; }
    if (y > 0) { page++; y = 0; }
    for (let offset = 0; offset < height; offset += pageHeight) { const h = Math.min(pageHeight, height - offset); pieces.push({ page, y: 0, offset, height: h }); if (offset + h < height) page++; else y = h; }
    return pieces;
  }, get pages() { return page + 1; } };
}

/** Minimum active recitation time; pauses do not satisfy the minimum. */
export const canFinishHizb = (seconds: number, minimum = 540) => Number.isFinite(seconds) && seconds >= Math.max(540, minimum);
