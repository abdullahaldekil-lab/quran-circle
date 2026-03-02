import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export const usePermissions = () => {
  const { profile, session } = useAuth();
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPermissions = useCallback(async () => {
    if (!session?.user?.id || !profile) {
      setPermissions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const userId = session.user.id;
    const role = profile.role as string;

    // Manager gets all permissions
    if (role === "manager") {
      const { data: allPerms } = await supabase
        .from("permissions")
        .select("name");
      setPermissions(allPerms?.map((p) => p.name) || []);
      setLoading(false);
      return;
    }

    // Fetch role permissions
    const { data: rolePerms } = await supabase
      .from("role_permissions")
      .select("permission_id, permissions(name), roles!inner(name)")
      .eq("roles.name", role);

    const rolePermNames = new Set(
      rolePerms?.map((rp: any) => rp.permissions?.name).filter(Boolean) || []
    );

    // Fetch user-level overrides
    const { data: userPerms } = await supabase
      .from("user_permissions")
      .select("permission_id, granted, permissions(name)")
      .eq("user_id", userId);

    // Apply overrides
    const finalPerms = new Set(rolePermNames);
    userPerms?.forEach((up: any) => {
      const permName = up.permissions?.name;
      if (!permName) return;
      if (up.granted) {
        finalPerms.add(permName);
      } else {
        finalPerms.delete(permName);
      }
    });

    setPermissions(Array.from(finalPerms));
    setLoading(false);
  }, [session?.user?.id, profile?.role]);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  // Subscribe to realtime changes on user_permissions and role_permissions
  useEffect(() => {
    if (!session?.user?.id) return;

    const channel = supabase
      .channel('permissions-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_permissions', filter: `user_id=eq.${session.user.id}` },
        () => fetchPermissions()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'role_permissions' },
        () => fetchPermissions()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id, fetchPermissions]);

  const hasPermission = (permissionName: string): boolean => {
    if (profile?.role === "manager") return true;
    return permissions.includes(permissionName);
  };

  const refetch = fetchPermissions;

  return { permissions, hasPermission, loading, refetch };
};
