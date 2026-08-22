import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { activePlanFor } from "@/lib/planTerm";
import { normalizePace, paceLabel, type DailyPace } from "@/lib/madarij-pace";

export interface StudentTrackInfo {
  /** معرّف التسجيل في برنامج مدارج */
  id: string;
  track_name?: string | null;
  hizb_number?: number | null;
  part_number?: number | null;
  daily_pace: DailyPace;
  pace_label: string;
}

/**
 * مسار الحفظ صار جزءاً من برنامج مدارج: التسجيل النشط في مدارج هو المسار
 * المعتمد، والخطة السنوية تُقبل كذلك كمسار صالح للتسميع.
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
      const [planRes, enrollRes] = await Promise.all([
        supabase
          .from("student_annual_plans")
          .select("*")
          .eq("student_id", studentId)
          .eq("status", "active"),
        supabase
          .from("madarij_enrollments")
          .select("id, hizb_number, part_number, daily_pace, madarij_tracks!madarij_enrollments_track_id_fkey(name)")
          .eq("student_id", studentId)
          .eq("status", "active")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (!alive) return;

      const today = new Date().toISOString().split("T")[0];
      setPlan(activePlanFor((planRes.data as any[]) || [], today));

      const en = enrollRes.data as any;
      if (en?.id) {
        setTrack({
          id: en.id,
          track_name: (en.madarij_tracks as any)?.name ?? null,
          hizb_number: en.hizb_number,
          part_number: en.part_number,
          daily_pace: normalizePace(en.daily_pace),
          pace_label: paceLabel(en.daily_pace),
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
