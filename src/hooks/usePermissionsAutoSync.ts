import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { supabase } from "@/integrations/supabase/client";
import { PERMISSIONS_REGISTRY } from "@/lib/permissionsRegistry";
import { syncPermissionsRegistry } from "@/lib/permissionsSync";

const SESSION_FLAG = "permissions_autosync_done";

/**
 * مزامنة تلقائية للصلاحيات:
 * إذا وُجدت صلاحيات في السجل (Registry) غير موجودة في قاعدة البيانات،
 * تُضاف تلقائيًا وتُربط بالأدوار الافتراضية — مرة واحدة لكل جلسة متصفح،
 * ولا تُنفَّذ إلا لمن يملك صلاحية إدارة الصلاحيات (تفرضها RLS أيضًا).
 */
export const usePermissionsAutoSync = () => {
  const { session, profile } = useAuth();
  const { hasPermission, loading, refetch } = usePermissions();
  const started = useRef(false);

  useEffect(() => {
    if (!session?.user?.id || !profile || loading || started.current) return;
    if (!(profile.role === "manager" || hasPermission("manage_permissions"))) return;
    if (sessionStorage.getItem(SESSION_FLAG)) return;

    started.current = true;
    sessionStorage.setItem(SESSION_FLAG, "1");

    (async () => {
      try {
        const { data, error } = await supabase.from("permissions").select("name");
        if (error) return;
        const existing = new Set((data || []).map((p) => p.name));
        const missing = PERMISSIONS_REGISTRY.filter((d) => !existing.has(d.name));
        if (missing.length === 0) return;

        const res = await syncPermissionsRegistry("auto");
        if (res.added.length > 0) {
          console.info(
            `[permissions] تمت مزامنة ${res.added.length} صلاحية ناقصة تلقائيًا`,
            res.added
          );
          refetch();
        }
      } catch (e) {
        console.error("[permissions] auto-sync failed", e);
      }
    })();
  }, [session?.user?.id, profile?.role, loading, hasPermission, refetch]);
};
