import { useState, useRef, useEffect, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { usePermissions } from "@/hooks/usePermissions";
import { formatDateSmart } from "@/lib/hijri";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import {
  User, KeyRound, Save, Shield, Camera, Mail, Clock,
  Building2, Briefcase, CalendarDays, Phone,
} from "lucide-react";

const callEdgeFunction = async (action: string, payload: any) => {
  const res = await supabase.functions.invoke("manage-users", {
    body: { action, ...payload },
  });
  if (res.error) throw new Error(res.error.message);
  if (res.data?.error) throw new Error(res.data.error);
  return res.data;
};

const ROLE_LABELS: Record<string, string> = {
  manager: "مدير",
  supervisor: "مشرف",
  assistant_supervisor: "نائب مشرف",
  teacher: "معلم",
  assistant_teacher: "معلم مساعد",
  secretary: "سكرتير",
  admin_staff: "إداري",
};

const ProfileSettings = () => {
  const { profile, user } = useAuth();
  const { permissions } = usePermissions();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  const [profileForm, setProfileForm] = useState({
    full_name: "",
    phone: "",
  });
  const [passwordForm, setPasswordForm] = useState({
    old_password: "",
    new_password: "",
    confirm_password: "",
  });

  useEffect(() => {
    if (profile) {
      setProfileForm({
        full_name: profile.full_name || "",
        phone: profile.phone || "",
      });
    }
  }, [profile]);

  // Fetch permissions with their categories and sources
  const { data: permissionsData } = useQuery({
    queryKey: ["profile-permissions", user?.id, profile?.role],
    queryFn: async () => {
      if (!user?.id || !profile) return { grouped: {}, userOverrides: {} };

      // All permissions
      const { data: allPerms } = await supabase.from("permissions").select("*");

      // Role permissions
      const { data: rolePerms } = await supabase
        .from("role_permissions")
        .select("permission_id, permissions(name), roles!inner(name)")
        .eq("roles.name", profile.role as string);

      const rolePermIds = new Set(rolePerms?.map((rp: any) => rp.permission_id) || []);

      // User overrides
      const { data: userPerms } = await supabase
        .from("user_permissions")
        .select("permission_id, granted, permissions(name)")
        .eq("user_id", user.id);

      const userOverrides: Record<string, boolean> = {};
      userPerms?.forEach((up: any) => {
        if (up.permissions?.name) userOverrides[up.permissions.name] = up.granted;
      });

      // Group by category
      const grouped: Record<string, Array<{ name: string; name_ar: string; source: string }>> = {};
      const isManager = profile.role === "manager";

      allPerms?.forEach((p) => {
        let source = "none";
        if (isManager) {
          source = "manager";
        } else if (userOverrides[p.name] === true) {
          source = "user_granted";
        } else if (userOverrides[p.name] === false) {
          source = "user_denied";
        } else if (rolePermIds.has(p.id)) {
          source = "role";
        }

        if (source === "none") return;

        if (!grouped[p.category]) grouped[p.category] = [];
        grouped[p.category].push({ name: p.name, name_ar: p.name_ar, source });
      });

      return { grouped, userOverrides };
    },
    enabled: !!user?.id && !!profile,
  });

  const updateProfileMutation = useMutation({
    mutationFn: (data: any) => callEdgeFunction("update_own_profile", data),
    onSuccess: () => {
      toast.success("تم تحديث الملف الشخصي بنجاح");
      window.location.reload();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const changePasswordMutation = useMutation({
    mutationFn: (data: any) => callEdgeFunction("change_own_password", data),
    onSuccess: () => {
      toast.success("تم تغيير كلمة المرور بنجاح");
      setPasswordForm({ old_password: "", new_password: "", confirm_password: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileForm.full_name.trim()) {
      toast.error("الاسم مطلوب");
      return;
    }
    updateProfileMutation.mutate(profileForm);
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordForm.old_password || !passwordForm.new_password) {
      toast.error("يرجى ملء جميع الحقول");
      return;
    }
    if (passwordForm.new_password.length < 8) {
      toast.error("كلمة المرور يجب أن تكون 8 أحرف على الأقل");
      return;
    }
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast.error("كلمة المرور الجديدة غير متطابقة");
      return;
    }
    changePasswordMutation.mutate({
      old_password: passwordForm.old_password,
      new_password: passwordForm.new_password,
    });
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    if (!file.type.startsWith("image/")) {
      toast.error("يجب اختيار ملف صورة");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("حجم الصورة يجب أن لا يتجاوز 2 ميجابايت");
      return;
    }

    setAvatarUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const filePath = `${user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("avatars")
        .getPublicUrl(filePath);

      const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      await callEdgeFunction("update_own_profile", {
        full_name: profile?.full_name,
        phone: profile?.phone,
        avatar_url: avatarUrl,
      });

      toast.success("تم تحديث الصورة الشخصية");
      window.location.reload();
    } catch (err: any) {
      toast.error("فشل رفع الصورة: " + err.message);
    } finally {
      setAvatarUploading(false);
    }
  };

  const initials = useMemo(() => {
    const name = profile?.full_name || "";
    return name.split(" ").slice(0, 2).map((w: string) => w[0]).join("");
  }, [profile?.full_name]);

  const sourceLabel = (source: string) => {
    switch (source) {
      case "manager": return <Badge variant="default" className="text-xs">مدير (كامل)</Badge>;
      case "role": return <Badge variant="secondary" className="text-xs">من الدور</Badge>;
      case "user_granted": return <Badge className="text-xs bg-emerald-600">فردية (ممنوحة)</Badge>;
      case "user_denied": return <Badge variant="destructive" className="text-xs">مرفوضة</Badge>;
      default: return null;
    }
  };

  const CATEGORY_LABELS: Record<string, string> = {
    halaqat: "الحلقات",
    students: "الطلاب",
    attendance: "الحضور",
    narration: "السرد",
    finance: "المالية",
    users: "المستخدمين",
    enrollment: "التسجيل",
    settings: "الإعدادات",
    madarij: "مدارج",
    rewards: "المكافآت",
    reports: "التقارير",
    documents: "المستندات",
    buses: "الحافلات",
    staff_attendance: "حضور العاملين",
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">الملف الشخصي</h1>
        <p className="text-muted-foreground">إدارة معلوماتك الشخصية وبيانات الدخول والصلاحيات</p>
      </div>

      <Tabs defaultValue="personal" dir="rtl">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="personal" className="gap-1.5">
            <User className="w-4 h-4" />
            المعلومات الشخصية
          </TabsTrigger>
          <TabsTrigger value="login" className="gap-1.5">
            <KeyRound className="w-4 h-4" />
            بيانات الدخول
          </TabsTrigger>
          <TabsTrigger value="permissions" className="gap-1.5">
            <Shield className="w-4 h-4" />
            الصلاحيات
          </TabsTrigger>
        </TabsList>

        {/* ===== Tab 1: Personal Info ===== */}
        <TabsContent value="personal">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                المعلومات الشخصية
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-6 mb-6">
                {/* Avatar */}
                <div className="flex flex-col items-center gap-2">
                  <Avatar className="w-24 h-24 text-2xl">
                    <AvatarImage src={(profile as any)?.avatar_url || ""} />
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleAvatarUpload}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={avatarUploading}
                  >
                    <Camera className="w-4 h-4 ml-1" />
                    {avatarUploading ? "جارٍ الرفع..." : "تغيير الصورة"}
                  </Button>
                </div>

                {/* Read-only info cards */}
                <div className="flex-1 grid gap-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Briefcase className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">المسمى الوظيفي:</span>
                    <span className="font-medium">{profile?.position_title || profile?.job_title || "—"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Building2 className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">القسم:</span>
                    <span className="font-medium">{profile?.department || "—"}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Shield className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">الدور:</span>
                    <Badge variant="secondary">
                      {ROLE_LABELS[profile?.role as string] || profile?.role || "—"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <CalendarDays className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">تاريخ الانضمام:</span>
                    <span className="font-medium">
                      {profile?.created_at
                        ? formatDateSmart(profile.created_at)
                        : "—"}
                    </span>
                  </div>
                </div>
              </div>

              <form onSubmit={handleProfileSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>الاسم الكامل *</Label>
                  <Input
                    value={profileForm.full_name}
                    onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5" />
                    رقم الهاتف
                  </Label>
                  <Input
                    value={profileForm.phone}
                    onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                    dir="ltr"
                  />
                </div>
                <Button type="submit" disabled={updateProfileMutation.isPending}>
                  <Save className="w-4 h-4 ml-2" />
                  {updateProfileMutation.isPending ? "جارٍ الحفظ..." : "حفظ التغييرات"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ===== Tab 2: Login Info ===== */}
        <TabsContent value="login">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="w-5 h-5" />
                  بيانات الحساب
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">البريد الإلكتروني:</span>
                  <span className="font-medium" dir="ltr">{user?.email || "—"}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">آخر تسجيل دخول:</span>
                  <span className="font-medium">
                    {profile?.last_login_at
                      ? new Date(profile.last_login_at).toLocaleString("ar-SA")
                      : "—"}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <KeyRound className="w-5 h-5" />
                  تغيير كلمة المرور
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handlePasswordSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>كلمة المرور الحالية *</Label>
                    <Input
                      type="password"
                      value={passwordForm.old_password}
                      onChange={(e) => setPasswordForm({ ...passwordForm, old_password: e.target.value })}
                      required
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>كلمة المرور الجديدة *</Label>
                    <Input
                      type="password"
                      value={passwordForm.new_password}
                      onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                      required
                      dir="ltr"
                      minLength={8}
                    />
                    <p className="text-xs text-muted-foreground">يجب أن تكون 8 أحرف على الأقل</p>
                  </div>
                  <div className="space-y-2">
                    <Label>تأكيد كلمة المرور الجديدة *</Label>
                    <Input
                      type="password"
                      value={passwordForm.confirm_password}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                      required
                      dir="ltr"
                    />
                  </div>
                  <Button type="submit" disabled={changePasswordMutation.isPending}>
                    <KeyRound className="w-4 h-4 ml-2" />
                    {changePasswordMutation.isPending ? "جارٍ التغيير..." : "تغيير كلمة المرور"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ===== Tab 3: Permissions ===== */}
        <TabsContent value="permissions">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                الصلاحيات الفعلية
              </CardTitle>
            </CardHeader>
            <CardContent>
              {profile?.role === "manager" && (
                <div className="mb-4 p-3 rounded-md bg-muted text-sm text-muted-foreground">
                  بصفتك مديراً، لديك وصول كامل لجميع الصلاحيات تلقائياً.
                </div>
              )}

              {permissionsData?.grouped && Object.keys(permissionsData.grouped).length > 0 ? (
                <div className="space-y-4">
                  {Object.entries(permissionsData.grouped).map(([category, perms]) => (
                    <div key={category}>
                      <h4 className="font-semibold text-sm mb-2 text-foreground">
                        {CATEGORY_LABELS[category] || category}
                      </h4>
                      <div className="grid gap-1.5">
                        {perms.map((p) => (
                          <div
                            key={p.name}
                            className="flex items-center justify-between py-1.5 px-3 rounded-md bg-muted/50 text-sm"
                          >
                            <span className={p.source === "user_denied" ? "line-through text-muted-foreground" : ""}>
                              {p.name_ar}
                            </span>
                            {sourceLabel(p.source)}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">لا توجد صلاحيات مسجلة.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProfileSettings;
