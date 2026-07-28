import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { activePlanFor } from "@/lib/planTerm";

export interface StudentTrackInfo {
  id: string;
  level_track_id: string;
  track_name?: string | null;
  branch_name?: string | null;
  part_number?: number | null;
  progress_percentage?: number | null;
}

/**
 * A student may not be recited to without a memorization path in place.
 * The memorization track (مسار الحفظ) is what is followed daily; an annual
 * plan is also accepted as a valid path when present.
 */
export const useStudentPlan = (studentId?: string | null, refreshKey: number = 0) => {
  const [plan, setPlan] = useState<any>(null);
  const [track, setTrack] = useState<StudentTrackInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!studentId) {
      setPlan(null);
      setTrack(null);
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);

    (async () => {
      const [planRes, levelRes] = await Promise.all([
        supabase
          .from("student_annual_plans")
          .select("*")
          .eq("student_id", studentId)
          .eq("status", "active"),
        supabase
          .from("student_levels")
          .select("id, level_track_id, part_number, progress_percentage, branch_id, track_kind, status")
          .eq("student_id", studentId)
          .eq("status", "active")
          .maybeSingle(),
      ]);
      if (!alive) return;

      const today = new Date().toISOString().split("T")[0];
      setPlan(activePlanFor((planRes.data as any[]) || [], today));

      const level = levelRes.data as any;
      if (level?.level_track_id) {
        const [trackRes, branchRes] = await Promise.all([
          supabase.from("level_tracks").select("name").eq("id", level.level_track_id).maybeSingle(),
          level.branch_id
            ? supabase.from("level_branches").select("name").eq("id", level.branch_id).maybeSingle()
            : Promise.resolve({ data: null } as any),
        ]);
        if (!alive) return;
        setTrack({
          id: level.id,
          level_track_id: level.level_track_id,
          track_name: (trackRes.data as any)?.name ?? null,
          branch_name: (branchRes?.data as any)?.name ?? null,
          part_number: level.part_number,
          progress_percentage: level.progress_percentage,
        });
      } else {
        setTrack(null);
      }
      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [studentId, refreshKey]);

  const hasTrack = !!track;
  const hasAnnualPlan = !!plan;

  return { plan, track, hasTrack, hasAnnualPlan, hasPlan: hasTrack || hasAnnualPlan, loading };
};
