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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Search, Shield, Users, Lock } from "lucide-react";

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

const PermissionsManagement = () => {
  const { session } = useAuth();
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

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [rolesRes, permsRes, profilesRes] = await Promise.all([
      supabase.from("roles").select("*").order("is_system", { ascending: false }),
      supabase.from("permissions").select("*").order("category"),
      supabase.from("profiles").select("id, full_name, role, active").eq("active", true).order("full_name"),
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
    // Get role permissions
    const { data: rps } = await supabase
      .from("role_permissions")
      .select("permission_id, roles!inner(name)")
      .eq("roles.name", user.role);
    setUserRolePerms(rps?.map((rp) => rp.permission_id) || []);

    // Get user overrides
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
      // No override - add one (opposite of role)
      const granted = !hasRolePerm;
      await supabase.from("user_permissions").upsert({
        user_id: selectedUser.id,
        permission_id: permId,
        granted,
      }, { onConflict: "user_id,permission_id" });
      setUserPermOverrides((prev) => ({ ...prev, [permId]: granted }));
    } else {
      // Has override - remove it (revert to role default)
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

      <Tabs defaultValue="roles" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="roles" className="gap-2"><Shield className="w-4 h-4" /> الأدوار</TabsTrigger>
          <TabsTrigger value="permissions" className="gap-2"><Lock className="w-4 h-4" /> الصلاحيات</TabsTrigger>
          <TabsTrigger value="users" className="gap-2"><Users className="w-4 h-4" /> المستخدمون</TabsTrigger>
        </TabsList>

        {/* === ROLES TAB === */}
        <TabsContent value="roles" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Roles list */}
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

            {/* Role permissions */}
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

          {/* Role dialog */}
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
            {/* User list */}
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

            {/* User permissions */}
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
      </Tabs>
    </div>
  );
};

export default PermissionsManagement;
