import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { supabase } from "@/integrations/supabase/client";
import { PERMISSIONS_REGISTRY } from "@/lib/permissionsRegistry";
import { syncPermissionsRegistry } from "@/lib/permissionsSync";

const SIGNATURE_KEY = "permissions_autosync_signature";

/** بصمة السجل: تتغيّر تلقائيًا عند إضافة أو تعديل أي صلاحية */
const registrySignature = () =>
  PERMISSIONS_REGISTRY.map((p) => `${p.name}:${p.name_ar}:${p.category}`)
    .sort()
    .join("|")
    .length +
  ":" +
  PERMISSIONS_REGISTRY.length;

/**
 * مزامنة تلقائية للصلاحيات:
 * أي صلاحية جديدة تُضاف في PERMISSIONS_REGISTRY تُزامن تلقائيًا مع قاعدة
 * البيانات وتُربط بالأدوار الافتراضية — عند أول تحميل بعد أي إضافة/تعديل،
 * وأيضًا إن وُجدت صلاحيات ناقصة في DB لأي سبب.
 * لا تُنفَّذ إلا لمن يملك صلاحية إدارة الصلاحيات (تفرضها RLS أيضًا).
 */
export const usePermissionsAutoSync = () => {
  const { session, profile } = useAuth();
  const { hasPermission, loading, refetch } = usePermissions();
  const started = useRef(false);

  useEffect(() => {
    if (!session?.user?.id || !profile || loading || started.current) return;
    if (!(profile.role === "manager" || hasPermission("manage_permissions"))) return;

    started.current = true;
    const signature = registrySignature();

    (async () => {
      try {
        const { data, error } = await supabase.from("permissions").select("name");
        if (error) return;
        const existing = new Set((data || []).map((p) => p.name));
        const missing = PERMISSIONS_REGISTRY.filter((d) => !existing.has(d.name));
        const signatureChanged = localStorage.getItem(SIGNATURE_KEY) !== signature;

        if (missing.length === 0 && !signatureChanged) return;

        const res = await syncPermissionsRegistry("auto");
        localStorage.setItem(SIGNATURE_KEY, signature);
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
