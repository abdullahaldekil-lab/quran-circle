import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";

/**
 * Hook that returns the halaqat IDs a user is allowed to access.
 * - Manager/Secretary/Admin: all halaqat (returns null = no filter)
 * - Supervisor: all halaqat read-only (returns null = no filter)
 * - Teacher/Assistant: only assigned halaqat + temporary overrides
 */
export const useTeacherHalaqat = () => {
  const { user } = useAuth();
  const { role, isManager, isAdminStaff, isSupervisor } = useRole();
  const [allowedHalaqatIds, setAllowedHalaqatIds] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [isReadOnly, setIsReadOnly] = useState(false);

  // Full access roles don't need filtering
  const hasFullAccess = isManager || isAdminStaff;

  useEffect(() => {
    if (!user) { setLoading(false); return; }

    if (hasFullAccess) {
      setAllowedHalaqatIds(null); // null = no filter
      setIsReadOnly(false);
      setLoading(false);
      return;
    }

    if (isSupervisor) {
      setAllowedHalaqatIds(null); // supervisors see all, read-only
      setIsReadOnly(true);
      setLoading(false);
      return;
    }

    // Teachers: fetch assigned halaqat + temporary overrides
    const fetchAccess = async () => {
      const today = new Date().toISOString().split("T")[0];
      
      const [halaqatRes, overridesRes] = await Promise.all([
        supabase
          .from("halaqat")
          .select("id")
          .eq("active", true)
          .or(`teacher_id.eq.${user.id},assistant_teacher_id.eq.${user.id}`),
        supabase
          .from("temporary_access_overrides")
          .select("halaqa_id")
          .eq("user_id", user.id)
          .lte("start_date", today)
          .gte("end_date", today),
      ]);

      const assignedIds = (halaqatRes.data || []).map((h) => h.id);
      const overrideIds = (overridesRes.data || []).map((o) => o.halaqa_id);
      const allIds = [...new Set([...assignedIds, ...overrideIds])];
      
      setAllowedHalaqatIds(allIds);
      setIsReadOnly(false);
      setLoading(false);
    };

    fetchAccess();
  }, [user, role, hasFullAccess, isSupervisor]);

  /**
   * Filter a halaqat list to only allowed ones.
   * Returns all if user has full access.
   */
  const filterHalaqat = <T extends { id: string }>(halaqat: T[]): T[] => {
    if (allowedHalaqatIds === null) return halaqat;
    return halaqat.filter((h) => allowedHalaqatIds.includes(h.id));
  };

  /**
   * Check if a specific halaqa is accessible
   */
  const canAccessHalaqa = (halaqaId: string): boolean => {
    if (allowedHalaqatIds === null) return true;
    return allowedHalaqatIds.includes(halaqaId);
  };

  /**
   * Check if a student (by halaqa_id) is accessible
   */
  const canAccessStudent = (studentHalaqaId: string | null): boolean => {
    if (allowedHalaqatIds === null) return true;
    if (!studentHalaqaId) return false;
    return allowedHalaqatIds.includes(studentHalaqaId);
  };

  return {
    allowedHalaqatIds,
    loading,
    isReadOnly,
    hasFullAccess: hasFullAccess || false,
    filterHalaqat,
    canAccessHalaqa,
    canAccessStudent,
  };
};
