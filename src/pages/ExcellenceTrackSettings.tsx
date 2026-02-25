import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowRight, Save } from "lucide-react";

interface Track {
  id: string;
  track_name: string;
}

interface TrackSettings {
  id?: string;
  track_id: string;
  min_monthly_performance: number;
  min_attendance_rate: number;
  min_hizb_count: number;
  auto_remove_on_failure: boolean;
  auto_notify_parent: boolean;
}

export default function ExcellenceTrackSettings() {
  const navigate = useNavigate();
  const { isManager } = useRole();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [selectedTrackId, setSelectedTrackId] = useState("");
  const [settings, setSettings] = useState<TrackSettings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchTracks();
  }, []);

  useEffect(() => {
    if (selectedTrackId) fetchSettings(selectedTrackId);
  }, [selectedTrackId]);

  const fetchTracks = async () => {
    const { data } = await supabase
      .from("excellence_tracks")
      .select("id, track_name")
      .eq("is_active", true)
      .order("track_name");
    setTracks(data || []);
  };

  const fetchSettings = async (trackId: string) => {
    const { data } = await supabase
      .from("excellence_track_settings")
      .select("*")
      .eq("track_id", trackId)
      .maybeSingle();

    if (data) {
      setSettings({
        id: data.id,
        track_id: data.track_id,
        min_monthly_performance: Number(data.min_monthly_performance),
        min_attendance_rate: Number(data.min_attendance_rate),
        min_hizb_count: Number(data.min_hizb_count),
        auto_remove_on_failure: data.auto_remove_on_failure || false,
        auto_notify_parent: data.auto_notify_parent ?? true,
      });
    } else {
      setSettings({
        track_id: trackId,
        min_monthly_performance: 0,
        min_attendance_rate: 0,
        min_hizb_count: 0,
        auto_remove_on_failure: false,
        auto_notify_parent: true,
      });
    }
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);

    if (settings.id) {
      const { error } = await supabase
        .from("excellence_track_settings")
        .update({
          min_monthly_performance: settings.min_monthly_performance,
          min_attendance_rate: settings.min_attendance_rate,
          min_hizb_count: settings.min_hizb_count,
          auto_remove_on_failure: settings.auto_remove_on_failure,
          auto_notify_parent: settings.auto_notify_parent,
        })
        .eq("id", settings.id);
      if (error) toast.error("خطأ: " + error.message);
      else toast.success("تم حفظ الإعدادات");
    } else {
      const { data, error } = await supabase
        .from("excellence_track_settings")
        .insert({
          track_id: settings.track_id,
          min_monthly_performance: settings.min_monthly_performance,
          min_attendance_rate: settings.min_attendance_rate,
          min_hizb_count: settings.min_hizb_count,
          auto_remove_on_failure: settings.auto_remove_on_failure,
          auto_notify_parent: settings.auto_notify_parent,
        })
        .select()
        .single();
      if (error) toast.error("خطأ: " + error.message);
      else {
        toast.success("تم حفظ الإعدادات");
        setSettings({ ...settings, id: data.id });
      }
    }

    setSaving(false);
  };

  if (!isManager) {
    return <p className="text-center text-muted-foreground py-12">هذه الصفحة متاحة للمدير فقط.</p>;
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/excellence")}>
          <ArrowRight className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">إعدادات مسارات التميّز</h1>
          <p className="text-muted-foreground text-sm">تحديد معايير وشروط الاستمرار لكل مسار</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>اختر المسار</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedTrackId} onValueChange={setSelectedTrackId}>
            <SelectTrigger className="max-w-md">
              <SelectValue placeholder="اختر مسار التميّز" />
            </SelectTrigger>
            <SelectContent>
              {tracks.map((t) => (
                <SelectItem key={t.id} value={t.id}>{t.track_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {settings && (
        <Card>
          <CardHeader>
            <CardTitle>إعدادات المسار</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">الحد الأدنى للأداء الشهري</label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={settings.min_monthly_performance}
                  onChange={(e) =>
                    setSettings({ ...settings, min_monthly_performance: Number(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">الحد الأدنى لنسبة الحضور (%)</label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={settings.min_attendance_rate}
                  onChange={(e) =>
                    setSettings({ ...settings, min_attendance_rate: Number(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">الحد الأدنى لعدد الأحزاب</label>
                <Input
                  type="number"
                  min={0}
                  value={settings.min_hizb_count}
                  onChange={(e) =>
                    setSettings({ ...settings, min_hizb_count: Number(e.target.value) })
                  }
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">الإزالة التلقائية عند الإخفاق</p>
                  <p className="text-xs text-muted-foreground">إزالة الطالب تلقائياً إذا لم يحقق الحد الأدنى</p>
                </div>
                <Switch
                  checked={settings.auto_remove_on_failure}
                  onCheckedChange={(v) =>
                    setSettings({ ...settings, auto_remove_on_failure: v })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">إشعار ولي الأمر</p>
                  <p className="text-xs text-muted-foreground">إرسال إشعار لولي الأمر عند إضافة أو إزالة الطالب</p>
                </div>
                <Switch
                  checked={settings.auto_notify_parent}
                  onCheckedChange={(v) =>
                    setSettings({ ...settings, auto_notify_parent: v })
                  }
                />
              </div>
            </div>

            <Button onClick={handleSave} disabled={saving}>
              <Save className="w-4 h-4 ml-2" />
              {saving ? "جارٍ الحفظ..." : "حفظ الإعدادات"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
