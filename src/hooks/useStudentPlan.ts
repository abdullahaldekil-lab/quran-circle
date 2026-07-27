import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { activePlanFor } from "@/lib/planTerm";

/**
 * A student may not be recited to without a memorization plan in place, so this
 * hook resolves whether a plan covering today exists.
 */
export const useStudentPlan = (studentId?: string | null, refreshKey: number = 0) => {
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!studentId) {
      setPlan(null);
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);

    supabase
      .from("student_annual_plans")
      .select("*")
      .eq("student_id", studentId)
      .eq("status", "active")
      .then(({ data }) => {
        if (!alive) return;
        const today = new Date().toISOString().split("T")[0];
        setPlan(activePlanFor((data as any[]) || [], today));
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [studentId, refreshKey]);

  return { plan, hasPlan: !!plan, loading };
};
