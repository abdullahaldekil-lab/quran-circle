import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Search, Shield, Users, Lock, UserCog, RefreshCw } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Role {
  id: string;
  name: string;
  name_ar: string;
  description: string | null;
  is_system: boolean;
}

interface Permission {
  id: string;
  name: string;
  name_ar: string;
  category: string;
}

interface Profile {
  id: string;
  full_name: string;
  role: string;
  active: boolean;
  job_title?: string | null;
  updated_at?: string | null;
}

const categoryLabels: Record<string, string> = {
  halaqat: "الحلقات",
  students: "الطلاب",
  attendance: "الحضور",
  recitation: "التسميع",
  levels: "المستويات",
  madarij: "برنامج مدارج",
  rewards: "المكافآت والترتيب",
  operations: "العمليات والخدمات",
  finance: "المالية والتخطيط",
  admin: "الإدارة",
  enrollment: "القبول والتسجيل",
  settings: "الإعدادات",
};

const roleLabels: Record<string, string> = {
  manager: "مدير المجمع",
  supervisor: "مشرف تعليمي",
  assistant_supervisor: "مساعد مشرف",
  secretary: "سكرتير",
  admin_staff: "موظف إداري",
  teacher: "معلم",
  assistant_teacher: "معلم مساعد",
};

const roleBadgeColors: Record<string, string> = {
  manager: "bg-red-100 text-red-800",
  supervisor: "bg-purple-100 text-purple-800",
  assistant_supervisor: "bg-indigo-100 text-indigo-800",
  secretary: "bg-yellow-100 text-yellow-800",
  admin_staff: "bg-orange-100 text-orange-800",
  teacher: "bg-green-100 text-green-800",
  assistant_teacher: "bg-teal-100 text-teal-800",
};

interface AuditLogEntry {
  id: string;
  created_at: string;
  action_type: string;
  details: string | null;
  actor_user_id: string | null;
  target_user_id: string | null;
  actor_name?: string;
  target_name?: string;
}

const PermissionsManagement = () => {
  const { session, profile: authProfile } = useAuth();
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  // Role editing
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [rolePermissions, setRolePermissions] = useState<string[]>([]);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<{ name_ar: string; description: string }>({ name_ar: "", description: "" });
  const [isNewRole, setIsNewRole] = useState(false);

  // User editing
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [userPermOverrides, setUserPermOverrides] = useState<Record<string, boolean | null>>({});
  const [userRolePerms, setUserRolePerms] = useState<string[]>([]);
  const [userSearch, setUserSearch] = useState("");

  // Role change tab
  const [roleChangeSearch, setRoleChangeSearch] = useState("");
  const [roleChangeFilter, setRoleChangeFilter] = useState("all");
  const [roleChangeDialogOpen, setRoleChangeDialogOpen] = useState(false);
  const [roleChangeTarget, setRoleChangeTarget] = useState<Profile | null>(null);
  const [newRoleValue, setNewRoleValue] = useState("");
  const [roleChangeReason, setRoleChangeReason] = useState("");
  const [newRolePermIds, setNewRolePermIds] = useState<string[]>([]);
  const [roleChangeSaving, setRoleChangeSaving] = useState(false);
  const [roleAuditLog, setRoleAuditLog] = useState<AuditLogEntry[]>([]);

  const isManager = authProfile?.role === "manager";

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [rolesRes, permsRes, profilesRes] = await Promise.all([
      supabase.from("roles").select("*").order("is_system", { ascending: false }),
      supabase.from("permissions").select("*").order("category"),
      supabase.from("profiles").select("id, full_name, role, active, job_title, updated_at").eq("active", true).order("full_name"),
    ]);
    setRoles(rolesRes.data || []);
    setPermissions(permsRes.data || []);
    setProfiles(profilesRes.data || []);
    setLoading(false);
  };

  // ---- ROLES TAB ----
  const selectRole = async (role: Role) => {
    setSelectedRole(role);
    const { data } = await supabase
      .from("role_permissions")
      .select("permission_id")
      .eq("role_id", role.id);
    setRolePermissions(data?.map((rp) => rp.permission_id) || []);
  };

  const toggleRolePermission = async (permId: string) => {
    if (!selectedRole) return;
    const has = rolePermissions.includes(permId);
    if (has) {
      await supabase.from("role_permissions").delete().eq("role_id", selectedRole.id).eq("permission_id", permId);
      setRolePermissions((prev) => prev.filter((id) => id !== permId));
    } else {
      await supabase.from("role_permissions").insert({ role_id: selectedRole.id, permission_id: permId });
      setRolePermissions((prev) => [...prev, permId]);
    }
    toast({ title: "تم التحديث" });
  };

  const openNewRoleDialog = () => {
    setIsNewRole(true);
    setEditingRole({ name_ar: "", description: "" });
    setRoleDialogOpen(true);
  };

  const openEditRoleDialog = (role: Role) => {
    setIsNewRole(false);
    setEditingRole({ name_ar: role.name_ar, description: role.description || "" });
    setSelectedRole(role);
    setRoleDialogOpen(true);
  };

  const saveRole = async () => {
    if (!editingRole.name_ar.trim()) return;
    if (isNewRole) {
      const slug = `custom_${Date.now()}`;
      const { error } = await supabase.from("roles").insert({
        name: slug,
        name_ar: editingRole.name_ar,
        description: editingRole.description || null,
        is_system: false,
      });
      if (error) { toast({ title: "خطأ", description: error.message, variant: "destructive" }); return; }
    } else if (selectedRole) {
      await supabase.from("roles").update({
        name_ar: editingRole.name_ar,
        description: editingRole.description || null,
      }).eq("id", selectedRole.id);
    }
    setRoleDialogOpen(false);
    fetchData();
    toast({ title: "تم الحفظ" });
  };

  const deleteRole = async (role: Role) => {
    if (role.is_system) { toast({ title: "لا يمكن حذف دور النظام", variant: "destructive" }); return; }
    await supabase.from("roles").delete().eq("id", role.id);
    if (selectedRole?.id === role.id) setSelectedRole(null);
    fetchData();
    toast({ title: "تم الحذف" });
  };

  // ---- USERS TAB ----
  const selectUser = async (user: Profile) => {
    setSelectedUser(user);
    const { data: rps } = await supabase
      .from("role_permissions")
      .select("permission_id, roles!inner(name)")
      .eq("roles.name", user.role);
    setUserRolePerms(rps?.map((rp) => rp.permission_id) || []);

    const { data: ups } = await supabase
      .from("user_permissions")
      .select("permission_id, granted")
      .eq("user_id", user.id);
    const overrides: Record<string, boolean | null> = {};
    ups?.forEach((up) => { overrides[up.permission_id] = up.granted; });
    setUserPermOverrides(overrides);
  };

  const toggleUserPermission = async (permId: string) => {
    if (!selectedUser) return;
    const currentOverride = userPermOverrides[permId];
    const hasRolePerm = userRolePerms.includes(permId);

    if (currentOverride === undefined || currentOverride === null) {
      const granted = !hasRolePerm;
      await supabase.from("user_permissions").upsert({
        user_id: selectedUser.id,
        permission_id: permId,
        granted,
      }, { onConflict: "user_id,permission_id" });
      setUserPermOverrides((prev) => ({ ...prev, [permId]: granted }));
    } else {
      await supabase.from("user_permissions").delete()
        .eq("user_id", selectedUser.id).eq("permission_id", permId);
      setUserPermOverrides((prev) => {
        const next = { ...prev };
        delete next[permId];
        return next;
      });
    }
    toast({ title: "تم التحديث" });
  };

  const getUserPermState = (permId: string): { active: boolean; source: "role" | "user" | "denied" } => {
    const override = userPermOverrides[permId];
    if (override === true) return { active: true, source: "user" };
    if (override === false) return { active: false, source: "denied" };
    const hasRole = userRolePerms.includes(permId);
    return { active: hasRole, source: "role" };
  };

  const filteredProfiles = profiles.filter((p) =>
    p.full_name.includes(userSearch) || p.role.includes(userSearch)
  );

  const groupedPermissions = permissions.reduce((acc, p) => {
    if (!acc[p.category]) acc[p.category] = [];
    acc[p.category].push(p);
    return acc;
  }, {} as Record<string, Permission[]>);

  // ---- ROLE CHANGE TAB ----
  const roleChangeProfiles = profiles.filter((p) => {
    const matchSearch = p.full_name.includes(roleChangeSearch) || p.role.includes(roleChangeSearch);
    const matchFilter = roleChangeFilter === "all" || p.role === roleChangeFilter;
    return matchSearch && matchFilter;
  });

  const fetchNewRolePerms = async (roleName: string) => {
    const { data } = await supabase
      .from("role_permissions")
      .select("permission_id, roles!inner(name)")
      .eq("roles.name", roleName);
    setNewRolePermIds(data?.map((rp) => rp.permission_id) || []);
  };

  const openRoleChangeDialog = (user: Profile) => {
    setRoleChangeTarget(user);
    setNewRoleValue("");
    setRoleChangeReason("");
    setNewRolePermIds([]);
    setRoleChangeDialogOpen(true);
  };

  const fetchRoleAuditLog = async () => {
    const { data } = await supabase
      .from("admin_audit_log")
      .select("*")
      .eq("action_type", "role_changed")
      .order("created_at", { ascending: false })
      .limit(20);

    if (data && data.length > 0) {
      const userIds = new Set<string>();
      data.forEach((d) => {
        if (d.actor_user_id) userIds.add(d.actor_user_id);
        if (d.target_user_id) userIds.add(d.target_user_id);
      });
      const { data: names } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", Array.from(userIds));
      const nameMap: Record<string, string> = {};
      names?.forEach((n) => { nameMap[n.id] = n.full_name; });

      setRoleAuditLog(data.map((d) => ({
        ...d,
        actor_name: d.actor_user_id ? nameMap[d.actor_user_id] || "—" : "—",
        target_name: d.target_user_id ? nameMap[d.target_user_id] || "—" : "—",
      })));
    } else {
      setRoleAuditLog([]);
    }
  };

  const handleRoleChange = async () => {
    if (!roleChangeTarget || !newRoleValue || !session?.user?.id) return;
    if (newRoleValue === roleChangeTarget.role) {
      toast({ title: "الدور الجديد مطابق للحالي", variant: "destructive" });
      return;
    }

    // Check if changing last manager
    if (roleChangeTarget.role === "manager" && newRoleValue !== "manager") {
      const managerCount = profiles.filter((p) => p.role === "manager").length;
      if (managerCount <= 1) {
        toast({ title: "لا يمكن تغيير دور المدير الأخير في النظام", variant: "destructive" });
        return;
      }
    }

    setRoleChangeSaving(true);
    try {
      const oldRole = roleChangeTarget.role;

      // 1. Update profile role
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ role: newRoleValue as any })
        .eq("id", roleChangeTarget.id);

      if (updateError) throw updateError;

      // 2. Call manage-users edge function
      try {
        await supabase.functions.invoke("manage-users", {
          body: {
            action: "admin_edit_user",
            user_id: roleChangeTarget.id,
            role: newRoleValue,
          },
        });
      } catch (e) {
        console.error("Edge function error (non-blocking):", e);
      }

      // 3. Audit log
      await supabase.from("admin_audit_log").insert({
        actor_user_id: session.user.id,
        action_type: "role_changed",
        target_user_id: roleChangeTarget.id,
        details: `تغيير الدور من ${roleLabels[oldRole] || oldRole} إلى ${roleLabels[newRoleValue] || newRoleValue}. السبب: ${roleChangeReason || "غير محدد"}`,
      });

      toast({ title: "تم تغيير الدور بنجاح" });
      setRoleChangeDialogOpen(false);
      fetchData();
      fetchRoleAuditLog();
    } catch (e: any) {
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    } finally {
      setRoleChangeSaving(false);
    }
  };

  // Fetch audit log when role-change tab is selected
  const handleTabChange = (value: string) => {
    if (value === "role-change") {
      fetchRoleAuditLog();
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-muted-foreground">جارٍ التحميل...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center gap-3">
        <Shield className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">إدارة الصلاحيات</h1>
          <p className="text-muted-foreground text-sm">التحكم في أدوار وصلاحيات المستخدمين</p>
        </div>
      </div>

      <Tabs defaultValue="roles" className="space-y-4" onValueChange={handleTabChange}>
        <TabsList className={`grid w-full ${isManager ? "grid-cols-4" : "grid-cols-3"}`}>
          <TabsTrigger value="roles" className="gap-2"><Shield className="w-4 h-4" /> الأدوار</TabsTrigger>
          <TabsTrigger value="permissions" className="gap-2"><Lock className="w-4 h-4" /> الصلاحيات</TabsTrigger>
          <TabsTrigger value="users" className="gap-2"><Users className="w-4 h-4" /> المستخدمون</TabsTrigger>
          {isManager && (
            <TabsTrigger value="role-change" className="gap-2"><UserCog className="w-4 h-4" /> تغيير الأدوار</TabsTrigger>
          )}
        </TabsList>

        {/* === ROLES TAB === */}
        <TabsContent value="roles" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">الأدوار</CardTitle>
                  <Button size="sm" onClick={openNewRoleDialog}><Plus className="w-4 h-4 ml-1" /> دور جديد</Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {roles.map((role) => (
                  <div
                    key={role.id}
                    className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedRole?.id === role.id ? "bg-primary/10 border border-primary/30" : "hover:bg-muted"
                    }`}
                    onClick={() => selectRole(role)}
                  >
                    <div>
                      <p className="font-medium">{role.name_ar}</p>
                      {role.is_system && <Badge variant="secondary" className="text-xs mt-1">نظام</Badge>}
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); openEditRoleDialog(role); }}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      {!role.is_system && (
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={(e) => { e.stopPropagation(); deleteRole(role); }}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">
                  {selectedRole ? `صلاحيات: ${selectedRole.name_ar}` : "اختر دورًا لعرض صلاحياته"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedRole ? (
                  <div className="space-y-6">
                    {Object.entries(groupedPermissions).map(([cat, perms]) => (
                      <div key={cat}>
                        <h3 className="font-semibold text-sm text-muted-foreground mb-2">{categoryLabels[cat] || cat}</h3>
                        <div className="space-y-2">
                          {perms.map((perm) => (
                            <div key={perm.id} className="flex items-center justify-between py-1.5 px-3 rounded hover:bg-muted/50">
                              <span className="text-sm">{perm.name_ar}</span>
                              <Switch
                                checked={rolePermissions.includes(perm.id)}
                                onCheckedChange={() => toggleRolePermission(perm.id)}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-12">اختر دورًا من القائمة لعرض وتعديل صلاحياته</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Dialog open={roleDialogOpen} onOpenChange={setRoleDialogOpen}>
            <DialogContent dir="rtl">
              <DialogHeader>
                <DialogTitle>{isNewRole ? "إضافة دور جديد" : "تعديل الدور"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label>اسم الدور</Label>
                  <Input value={editingRole.name_ar} onChange={(e) => setEditingRole((p) => ({ ...p, name_ar: e.target.value }))} placeholder="اسم الدور" />
                </div>
                <div>
                  <Label>الوصف</Label>
                  <Input value={editingRole.description} onChange={(e) => setEditingRole((p) => ({ ...p, description: e.target.value }))} placeholder="وصف مختصر (اختياري)" />
                </div>
                <Button onClick={saveRole} className="w-full">حفظ</Button>
              </div>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* === PERMISSIONS TAB === */}
        <TabsContent value="permissions">
          <div className="space-y-6">
            {Object.entries(groupedPermissions).map(([cat, perms]) => (
              <Card key={cat}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{categoryLabels[cat] || cat}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {perms.map((perm) => (
                      <div key={perm.id} className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg">
                        <Lock className="w-4 h-4 text-muted-foreground shrink-0" />
                        <div>
                          <p className="text-sm font-medium">{perm.name_ar}</p>
                          <p className="text-xs text-muted-foreground">{perm.name}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* === USERS TAB === */}
        <TabsContent value="users" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">المستخدمون</CardTitle>
                <div className="relative mt-2">
                  <Search className="absolute right-3 top-2.5 w-4 h-4 text-muted-foreground" />
                  <Input
                    className="pr-9"
                    placeholder="بحث..."
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-1 max-h-[60vh] overflow-y-auto">
                {filteredProfiles.map((user) => (
                  <div
                    key={user.id}
                    className={`flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors ${
                      selectedUser?.id === user.id ? "bg-primary/10 border border-primary/30" : "hover:bg-muted"
                    }`}
                    onClick={() => selectUser(user)}
                  >
                    <div>
                      <p className="font-medium text-sm">{user.full_name}</p>
                      <p className="text-xs text-muted-foreground">{user.role}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">
                  {selectedUser ? `صلاحيات: ${selectedUser.full_name}` : "اختر مستخدمًا"}
                </CardTitle>
                {selectedUser && (
                  <p className="text-sm text-muted-foreground">
                    الدور: <Badge variant="outline">{selectedUser.role}</Badge>
                    <span className="mr-4 text-xs">
                      🟢 من الدور &nbsp; 🔵 فردية &nbsp; 🔴 مرفوضة — اضغط لتبديل التخصيص
                    </span>
                  </p>
                )}
              </CardHeader>
              <CardContent>
                {selectedUser ? (
                  <div className="space-y-6">
                    {Object.entries(groupedPermissions).map(([cat, perms]) => (
                      <div key={cat}>
                        <h3 className="font-semibold text-sm text-muted-foreground mb-2">{categoryLabels[cat] || cat}</h3>
                        <div className="space-y-2">
                          {perms.map((perm) => {
                            const state = getUserPermState(perm.id);
                            return (
                              <div key={perm.id} className="flex items-center justify-between py-1.5 px-3 rounded hover:bg-muted/50">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm">{perm.name_ar}</span>
                                  {state.source === "user" && <Badge className="text-xs bg-blue-100 text-blue-700 hover:bg-blue-100">فردية</Badge>}
                                  {state.source === "denied" && <Badge className="text-xs bg-red-100 text-red-700 hover:bg-red-100">مرفوضة</Badge>}
                                  {state.source === "role" && state.active && <Badge className="text-xs bg-green-100 text-green-700 hover:bg-green-100">من الدور</Badge>}
                                </div>
                                <Switch
                                  checked={state.active}
                                  onCheckedChange={() => toggleUserPermission(perm.id)}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground text-center py-12">اختر مستخدمًا لعرض وتعديل صلاحياته</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* === ROLE CHANGE TAB === */}
        {isManager && (
          <TabsContent value="role-change" className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <UserCog className="w-5 h-5" /> تغيير أدوار الموظفين
                  </CardTitle>
                  <Button size="sm" variant="outline" onClick={fetchRoleAuditLog}>
                    <RefreshCw className="w-4 h-4 ml-1" /> تحديث
                  </Button>
                </div>
                <div className="flex gap-3 mt-3">
                  <div className="relative flex-1">
                    <Search className="absolute right-3 top-2.5 w-4 h-4 text-muted-foreground" />
                    <Input
                      className="pr-9"
                      placeholder="بحث بالاسم..."
                      value={roleChangeSearch}
                      onChange={(e) => setRoleChangeSearch(e.target.value)}
                    />
                  </div>
                  <Select value={roleChangeFilter} onValueChange={setRoleChangeFilter}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="كل الأدوار" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">كل الأدوار</SelectItem>
                      {roles.map((r) => (
                        <SelectItem key={r.name} value={r.name}>{r.name_ar}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">الاسم</TableHead>
                        <TableHead className="text-right">الدور الحالي</TableHead>
                        <TableHead className="text-right">المسمى الوظيفي</TableHead>
                        <TableHead className="text-right">آخر تعديل</TableHead>
                        <TableHead className="text-right w-[120px]">إجراء</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {roleChangeProfiles.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">{user.full_name}</TableCell>
                          <TableCell>
                            <Badge className={`${roleBadgeColors[user.role] || "bg-muted text-muted-foreground"}`}>
                              {roleLabels[user.role] || user.role}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">{user.job_title || "—"}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {user.updated_at ? new Date(user.updated_at).toLocaleDateString("ar-SA") : "—"}
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openRoleChangeDialog(user)}
                            >
                              <Pencil className="w-3.5 h-3.5 ml-1" /> تغيير الدور
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                      {roleChangeProfiles.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-8">لا يوجد موظفون</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Role Change Dialog */}
            <Dialog open={roleChangeDialogOpen} onOpenChange={setRoleChangeDialogOpen}>
              <DialogContent dir="rtl" className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>تغيير دور الموظف</DialogTitle>
                </DialogHeader>
                {roleChangeTarget && (
                  <div className="space-y-4 mt-2">
                    <div>
                      <Label className="text-muted-foreground text-xs">اسم الموظف</Label>
                      <p className="font-semibold">{roleChangeTarget.full_name}</p>
                    </div>
                    <div>
                      <Label className="text-muted-foreground text-xs">الدور الحالي</Label>
                      <div className="mt-1">
                        <Badge className={`${roleBadgeColors[roleChangeTarget.role] || ""}`}>
                          {roleLabels[roleChangeTarget.role] || roleChangeTarget.role}
                        </Badge>
                      </div>
                    </div>
                    <div>
                      <Label>الدور الجديد</Label>
                      <Select
                        value={newRoleValue}
                        onValueChange={(val) => {
                          setNewRoleValue(val);
                          fetchNewRolePerms(val);
                        }}
                      >
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="اختر الدور الجديد" />
                        </SelectTrigger>
                        <SelectContent>
                          {roles.map((r) => (
                            <SelectItem key={r.name} value={r.name} disabled={r.name === roleChangeTarget.role}>
                              {r.name_ar}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* New role permissions preview */}
                    {newRoleValue && (
                      <div>
                        <Label className="text-muted-foreground text-xs">صلاحيات الدور الجديد</Label>
                        <ScrollArea className="h-[200px] mt-2 border rounded-md p-3">
                          {newRoleValue === "manager" ? (
                            <p className="text-sm text-green-700 font-medium">المدير يملك جميع الصلاحيات</p>
                          ) : (
                            <div className="space-y-3">
                              {Object.entries(groupedPermissions).map(([cat, perms]) => {
                                const activePerms = perms.filter((p) => newRolePermIds.includes(p.id));
                                if (activePerms.length === 0) return null;
                                return (
                                  <div key={cat}>
                                    <p className="text-xs font-bold text-muted-foreground mb-1">{categoryLabels[cat] || cat}</p>
                                    <div className="flex flex-wrap gap-1">
                                      {perms.map((p) => (
                                        <Badge
                                          key={p.id}
                                          variant={newRolePermIds.includes(p.id) ? "default" : "outline"}
                                          className="text-xs"
                                        >
                                          {p.name_ar}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                              {newRolePermIds.length === 0 && (
                                <p className="text-sm text-muted-foreground">لا توجد صلاحيات مخصصة لهذا الدور</p>
                              )}
                            </div>
                          )}
                        </ScrollArea>
                      </div>
                    )}

                    <div>
                      <Label>سبب التغيير (اختياري)</Label>
                      <Textarea
                        className="mt-1"
                        placeholder="أدخل سبب تغيير الدور..."
                        value={roleChangeReason}
                        onChange={(e) => setRoleChangeReason(e.target.value)}
                        rows={2}
                      />
                    </div>

                    <Button
                      className="w-full"
                      onClick={handleRoleChange}
                      disabled={!newRoleValue || roleChangeSaving}
                    >
                      {roleChangeSaving ? "جارٍ الحفظ..." : "تأكيد التغيير"}
                    </Button>
                  </div>
                )}
              </DialogContent>
            </Dialog>

            {/* Audit Log */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">سجل تغييرات الأدوار</CardTitle>
              </CardHeader>
              <CardContent>
                {roleAuditLog.length === 0 ? (
                  <p className="text-muted-foreground text-center py-6">لا توجد تغييرات مسجلة</p>
                ) : (
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-right">التاريخ</TableHead>
                          <TableHead className="text-right">المُغيِّر</TableHead>
                          <TableHead className="text-right">الموظف</TableHead>
                          <TableHead className="text-right">التفاصيل</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {roleAuditLog.map((log) => (
                          <TableRow key={log.id}>
                            <TableCell className="text-sm">
                              {new Date(log.created_at).toLocaleDateString("ar-SA")}
                            </TableCell>
                            <TableCell className="text-sm">{log.actor_name}</TableCell>
                            <TableCell className="text-sm">{log.target_name}</TableCell>
                            <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate">
                              {log.details}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default PermissionsManagement;
