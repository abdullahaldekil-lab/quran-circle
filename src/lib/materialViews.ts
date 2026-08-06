// Tracking of how enrichment materials are consumed (video/audio playback, downloads).
//
// The portal is reachable without a session, so the insert path stays anonymous-friendly
// and identifies the student by id/code when it is known.

import { supabase } from "@/integrations/supabase/client";

export type MaterialViewEvent = "open" | "play" | "download" | "complete";

export interface MaterialViewLog {
  material_id: string;
  event_type: MaterialViewEvent;
  student_id?: string | null;
  student_code?: string | null;
  user_id?: string | null;
  seconds_watched?: number;
  completion_percent?: number;
}

/** Clamp helper: playback numbers arrive from the DOM and can be NaN/Infinity. */
export const clampNumber = (value: unknown, min: number, max: number): number => {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.round(n)));
};

/** Percentage of a media element that was actually consumed. */
export const completionPercent = (seconds: unknown, duration: unknown): number => {
  const d = Number(duration);
  const s = Number(seconds);
  if (!Number.isFinite(d) || d <= 0 || !Number.isFinite(s) || s <= 0) return 0;
  return clampNumber((s / d) * 100, 0, 100);
};

/** A view counts as "watched" once 80% of the media has played. */
export const isCompleted = (percent: number): boolean => percent >= 80;

/** Fire-and-forget: a failed tracking insert must never block playback. */
export const logMaterialView = async (log: MaterialViewLog): Promise<boolean> => {
  if (!log.material_id) return false;
  const payload = {
    material_id: log.material_id,
    event_type: log.event_type,
    student_id: log.student_id || null,
    student_code: log.student_code || null,
    user_id: log.user_id || null,
    seconds_watched: clampNumber(log.seconds_watched ?? 0, 0, 200000),
    completion_percent: clampNumber(log.completion_percent ?? 0, 0, 100),
  };
  const { error } = await (supabase as any).from("program_material_views").insert(payload);
  return !error;
};

export interface MaterialViewRow {
  material_id: string;
  event_type: string;
  seconds_watched: number | null;
  completion_percent: number | null;
  student_id: string | null;
  student_code: string | null;
  viewed_at: string;
}

export interface MaterialStats {
  views: number;
  plays: number;
  downloads: number;
  completed: number;
  uniqueStudents: number;
  totalMinutes: number;
}

export const emptyStats = (): MaterialStats => ({
  views: 0,
  plays: 0,
  downloads: 0,
  completed: 0,
  uniqueStudents: 0,
  totalMinutes: 0,
});

/** Aggregates raw view rows into per-material counters for the admin panel. */
export const aggregateStats = (rows: MaterialViewRow[]): Record<string, MaterialStats> => {
  const byMaterial: Record<string, MaterialStats> = {};
  const seen: Record<string, Set<string>> = {};

  rows.forEach((r) => {
    const key = r.material_id;
    if (!key) return;
    if (!byMaterial[key]) {
      byMaterial[key] = emptyStats();
      seen[key] = new Set();
    }
    const s = byMaterial[key];
    s.views += 1;
    if (r.event_type === "play") s.plays += 1;
    if (r.event_type === "download") s.downloads += 1;
    if (r.event_type === "complete" || isCompleted(Number(r.completion_percent ?? 0))) {
      s.completed += 1;
    }
    s.totalMinutes += Math.round((Number(r.seconds_watched ?? 0) / 60) * 10) / 10;

    const who = r.student_id || r.student_code;
    if (who) seen[key].add(who);
  });

  Object.keys(byMaterial).forEach((k) => {
    byMaterial[k].uniqueStudents = seen[k].size;
    byMaterial[k].totalMinutes = Math.round(byMaterial[k].totalMinutes * 10) / 10;
  });

  return byMaterial;
};

/** Totals across every material, for the summary cards. */
export const totalStats = (perMaterial: Record<string, MaterialStats>): MaterialStats => {
  const t = emptyStats();
  Object.values(perMaterial).forEach((s) => {
    t.views += s.views;
    t.plays += s.plays;
    t.downloads += s.downloads;
    t.completed += s.completed;
    t.uniqueStudents += s.uniqueStudents;
    t.totalMinutes += s.totalMinutes;
  });
  t.totalMinutes = Math.round(t.totalMinutes * 10) / 10;
  return t;
};
