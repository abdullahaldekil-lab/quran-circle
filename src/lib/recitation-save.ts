// End-to-end save service for the recitation flow.
// Encapsulates: payload construction, DB insert (RLS enforced), and score computation.
// Extracted from src/pages/Recitation.tsx so the DB contract is testable.

import { aggregateCounts, calcScore, type MistakesBreakdown } from "./recitation-scoring";

export interface RecitationFormInput {
  memorized_from: string;
  memorized_to: string;
  review_from: string;
  review_to: string;
  linking_from: string;
  linking_to: string;
  mistakes_breakdown: MistakesBreakdown;
  notes: string;
}

export interface SaveRecitationParams {
  studentId: string;
  halaqaId: string;
  teacherId: string | null | undefined;
  form: RecitationFormInput;
  audioUrl?: string;
}

export interface RecitationRecordPayload {
  student_id: string;
  halaqa_id: string;
  teacher_id: string | null;
  memorized_from: string | null;
  memorized_to: string | null;
  review_from: string | null;
  review_to: string | null;
  linking_from: string | null;
  linking_to: string | null;
  mistakes_count: number;
  mistakes_breakdown: MistakesBreakdown;
  total_score: number;
  notes: string | null;
  audio_url: string | null;
}

export const buildRecitationRecordPayload = (
  p: SaveRecitationParams,
): RecitationRecordPayload => {
  const counts = aggregateCounts(p.form.mistakes_breakdown);
  const totalScore = calcScore(p.form.mistakes_breakdown);
  return {
    student_id: p.studentId,
    halaqa_id: p.halaqaId,
    teacher_id: p.teacherId ?? null,
    memorized_from: p.form.memorized_from || null,
    memorized_to: p.form.memorized_to || null,
    review_from: p.form.review_from || null,
    review_to: p.form.review_to || null,
    linking_from: p.form.linking_from || null,
    linking_to: p.form.linking_to || null,
    mistakes_count: counts.total,
    mistakes_breakdown: p.form.mistakes_breakdown,
    total_score: totalScore,
    notes: p.form.notes || null,
    audio_url: p.audioUrl || null,
  };
};

export interface SaveResult {
  ok: boolean;
  totalScore: number;
  error?: { message: string; code?: string };
}

// Supabase-shaped client (kept structural so tests can inject a mock).
export interface RecitationDbClient {
  from(table: string): {
    insert(row: RecitationRecordPayload): Promise<{ error: { message: string; code?: string } | null }>;
  };
}

export const saveRecitationRecord = async (
  db: RecitationDbClient,
  params: SaveRecitationParams,
): Promise<SaveResult> => {
  if (!params.studentId) {
    return { ok: false, totalScore: 0, error: { message: "missing student" } };
  }
  if (!params.teacherId) {
    // RLS on recitation_records requires teacher_id = auth.uid() for teachers.
    // Blocking client-side avoids a guaranteed DB rejection.
    return { ok: false, totalScore: 0, error: { message: "unauthenticated" } };
  }
  const payload = buildRecitationRecordPayload(params);
  const { error } = await db.from("recitation_records").insert(payload);
  if (error) {
    return { ok: false, totalScore: payload.total_score, error };
  }
  return { ok: true, totalScore: payload.total_score };
};
