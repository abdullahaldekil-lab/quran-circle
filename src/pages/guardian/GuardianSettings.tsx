import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import GuardianLayout from "@/components/GuardianLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const GuardianSettings = () => {
  const navigate = useNavigate();
  const [guardian, setGuardian] = useState<any>(null);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [changingPwd, setChangingPwd] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/guardian-auth"); return; }
      const { data } = await supabase.from("guardian_profiles").select("*").eq("id", session.user.id).maybeSingle();
      if (!data) { navigate("/guardian-auth"); return; }
      setGuardian(data);
      setFullName(data.full_name || "");
      setPhone(data.phone || "");
    })();
  }, [navigate]);

  const saveProfile = async () => {
    setSaving(true);
    const { error } = await supabase.from("guardian_profiles")
      .update({ full_name: fullName, phone }).eq("id", guardian.id);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("تم تحديث البيانات");
  };

  const changePassword = async () => {
    if (newPassword.length < 6) { toast.error("كلمة المرور قصيرة"); return; }
    setChangingPwd(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPwd(false);
    if (error) { toast.error(error.message); return; }
    setNewPassword("");
    toast.success("تم تغيير كلمة المرور");
  };

  return (
    <GuardianLayout guardianName={guardian?.full_name}>
      <div className="space-y-4 animate-fade-in">
        <h1 className="text-xl font-bold">إعدادات الحساب</h1>

        <Card>
          <CardHeader><CardTitle className="text-base">البيانات الشخصية</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>الاسم الكامل</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div>
              <Label>رقم الجوال</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} dir="ltr" />
            </div>
            <Button onClick={saveProfile} disabled={saving} className="w-full">
              {saving ? "جارٍ الحفظ..." : "حفظ التغييرات"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">تغيير كلمة المرور</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>كلمة المرور الجديدة</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} dir="ltr" />
            </div>
            <Button onClick={changePassword} disabled={changingPwd} className="w-full" variant="secondary">
              {changingPwd ? "جارٍ التحديث..." : "تغيير كلمة المرور"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </GuardianLayout>
  );
};

export default GuardianSettings;
