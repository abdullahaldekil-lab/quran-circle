import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface DynamicRole {
  id: string;
  name: string;
  name_ar: string;
  description?: string;
  is_system: boolean;
}

const FALLBACK_LABELS: Record<string, string> = {
  manager: "مدير المجمع",
  supervisor: "مشرف تعليمي",
  assistant_supervisor: "مساعد مشرف",
  secretary: "سكرتير",
  admin_staff: "موظف إداري",
  teacher: "معلم",
  assistant_teacher: "معلم مساعد",
};

/**
 * Fetches all roles (system + custom) from the `roles` table.
 * Provides a label map (name → name_ar) and the raw role list.
 */
export const useDynamicRoles = () => {
  const [roles, setRoles] = useState<DynamicRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [labels, setLabels] = useState<Record<string, string>>(FALLBACK_LABELS);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("roles")
        .select("id, name, name_ar, description, is_system")
        .order("is_system", { ascending: false })
        .order("name_ar");
      if (cancelled) return;
      const list = (data || []) as DynamicRole[];
      setRoles(list);
      const map: Record<string, string> = { ...FALLBACK_LABELS };
      list.forEach((r) => { map[r.name] = r.name_ar || r.name; });
      setLabels(map);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  return { roles, labels, loading };
};
