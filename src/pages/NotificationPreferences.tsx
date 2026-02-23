import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Bell, Mail, MessageCircle, GraduationCap, CheckSquare, Settings, Gift } from "lucide-react";

interface Prefs {
  id?: string;
  enable_in_app: boolean;
  enable_email: boolean;
  enable_whatsapp: boolean;
  academic_notifications: boolean;
  attendance_notifications: boolean;
  system_notifications: boolean;
  rewards_notifications: boolean;
}

const defaultPrefs: Prefs = {
  enable_in_app: true,
  enable_email: false,
  enable_whatsapp: false,
  academic_notifications: true,
  attendance_notifications: true,
  system_notifications: true,
  rewards_notifications: true,
};

const NotificationPreferences = () => {
  const { session } = useAuth();
  const [prefs, setPrefs] = useState<Prefs>(defaultPrefs);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!session?.user?.id) return;
    const fetch = async () => {
      const { data } = await supabase
        .from("user_notification_preferences")
        .select("*")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (data) setPrefs(data as Prefs);
      setLoading(false);
    };
    fetch();
  }, [session?.user?.id]);

  const save = async (updated: Prefs) => {
    if (!session?.user?.id) return;
    setPrefs(updated);
    const payload = { ...updated, user_id: session.user.id };
    delete (payload as any).id;

    if (prefs.id) {
      await supabase
        .from("user_notification_preferences")
        .update(payload)
        .eq("user_id", session.user.id);
    } else {
      const { data } = await supabase
        .from("user_notification_preferences")
        .insert([payload])
        .select()
        .single();
      if (data) setPrefs(data as Prefs);
    }
    toast.success("تم حفظ التفضيلات");
  };

  const toggle = (key: keyof Prefs) => {
    const updated = { ...prefs, [key]: !prefs[key] };
    save(updated);
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">جارٍ التحميل...</div>;

  return (
    <div className="space-y-6 max-w-2xl mx-auto" dir="rtl">
      <h1 className="text-2xl font-bold">تفضيلات الإشعارات</h1>

      <Card>
        <CardHeader><CardTitle className="text-lg">قنوات الإرسال</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><Bell className="w-4 h-4 text-primary" /><Label>إشعارات داخلية</Label></div>
            <Switch checked={prefs.enable_in_app} onCheckedChange={() => toggle("enable_in_app")} />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-primary" /><Label>البريد الإلكتروني</Label></div>
            <Switch checked={prefs.enable_email} onCheckedChange={() => toggle("enable_email")} />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><MessageCircle className="w-4 h-4 text-primary" /><Label>الواتساب</Label></div>
            <Switch checked={prefs.enable_whatsapp} onCheckedChange={() => toggle("enable_whatsapp")} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">أنواع الإشعارات</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><GraduationCap className="w-4 h-4 text-primary" /><Label>إشعارات أكاديمية</Label></div>
            <Switch checked={prefs.academic_notifications} onCheckedChange={() => toggle("academic_notifications")} />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><CheckSquare className="w-4 h-4 text-primary" /><Label>إشعارات الحضور</Label></div>
            <Switch checked={prefs.attendance_notifications} onCheckedChange={() => toggle("attendance_notifications")} />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><Settings className="w-4 h-4 text-primary" /><Label>إشعارات النظام</Label></div>
            <Switch checked={prefs.system_notifications} onCheckedChange={() => toggle("system_notifications")} />
          </div>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><Gift className="w-4 h-4 text-primary" /><Label>إشعارات المكافآت</Label></div>
            <Switch checked={prefs.rewards_notifications} onCheckedChange={() => toggle("rewards_notifications")} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default NotificationPreferences;
