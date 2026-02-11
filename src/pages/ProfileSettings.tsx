import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { User, KeyRound, Save } from "lucide-react";

const callEdgeFunction = async (action: string, payload: any) => {
  const res = await supabase.functions.invoke("manage-users", {
    body: { action, ...payload },
  });
  if (res.error) throw new Error(res.error.message);
  if (res.data?.error) throw new Error(res.data.error);
  return res.data;
};

const ProfileSettings = () => {
  const { profile, user } = useAuth();
  const [profileForm, setProfileForm] = useState({
    full_name: profile?.full_name || "",
    phone: profile?.phone || "",
  });
  const [passwordForm, setPasswordForm] = useState({
    old_password: "",
    new_password: "",
    confirm_password: "",
  });

  const updateProfileMutation = useMutation({
    mutationFn: (data: any) => callEdgeFunction("update_own_profile", data),
    onSuccess: () => {
      toast.success("تم تحديث الملف الشخصي بنجاح");
      // Refresh page to get updated profile
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

  return (
    <div className="space-y-6 max-w-2xl mx-auto" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">الملف الشخصي</h1>
        <p className="text-muted-foreground">إدارة معلوماتك الشخصية وكلمة المرور</p>
      </div>

      {/* Profile Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            المعلومات الشخصية
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleProfileSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>البريد الإلكتروني</Label>
              <Input value={user?.email || ""} disabled dir="ltr" className="bg-muted" />
              <p className="text-xs text-muted-foreground">لا يمكن تغيير البريد الإلكتروني</p>
            </div>
            <div className="space-y-2">
              <Label>الاسم الكامل *</Label>
              <Input
                value={profileForm.full_name}
                onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>رقم الهاتف</Label>
              <Input
                value={profileForm.phone}
                onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label>الدور</Label>
              <Input value={profile?.position_title || profile?.role || ""} disabled className="bg-muted" />
            </div>
            <Button type="submit" disabled={updateProfileMutation.isPending}>
              <Save className="w-4 h-4 ml-2" />
              {updateProfileMutation.isPending ? "جارٍ الحفظ..." : "حفظ التغييرات"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Separator />

      {/* Change Password */}
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
  );
};

export default ProfileSettings;
