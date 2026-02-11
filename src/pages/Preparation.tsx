import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Clock, Settings, Sun, Moon, Sunrise, Sunset, CloudSun } from "lucide-react";
import { useRole } from "@/hooks/useRole";

const PRAYER_LABELS: Record<string, { label: string; icon: React.ElementType }> = {
  fajr: { label: "الفجر", icon: Sunrise },
  dhuhr: { label: "الظهر", icon: Sun },
  asr: { label: "العصر", icon: CloudSun },
  maghrib: { label: "المغرب", icon: Sunset },
  isha: { label: "العشاء", icon: Moon },
};

const Preparation = () => {
  const { isManager } = useRole();
  const [config, setConfig] = useState<any>(null);
  const [prayerTimes, setPrayerTimes] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({ base_prayer: "asr", offset_minutes: 40, duration_minutes: 30 });

  // Update clock every second
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchConfig = useCallback(async () => {
    const { data } = await supabase
      .from("preparation_config")
      .select("*")
      .limit(1)
      .maybeSingle();
    if (data) {
      setConfig(data);
      setEditForm({
        base_prayer: data.base_prayer,
        offset_minutes: data.offset_minutes,
        duration_minutes: data.duration_minutes,
      });
    }
  }, []);

  const fetchPrayerTimes = useCallback(async () => {
    try {
      const { data, error } = await supabase.functions.invoke("prayer-times");
      if (error) throw error;
      setPrayerTimes(data);
    } catch (err) {
      console.error("Failed to fetch prayer times:", err);
      toast.error("تعذر جلب مواقيت الصلاة");
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchConfig(), fetchPrayerTimes()]).finally(() => setLoading(false));
  }, [fetchConfig, fetchPrayerTimes]);

  const handleSaveConfig = async () => {
    if (!config?.id) return;
    const { error } = await supabase
      .from("preparation_config")
      .update({
        base_prayer: editForm.base_prayer,
        offset_minutes: editForm.offset_minutes,
        duration_minutes: editForm.duration_minutes,
      })
      .eq("id", config.id);
    if (error) {
      toast.error("حدث خطأ أثناء الحفظ");
      return;
    }
    toast.success("تم حفظ الإعدادات");
    setEditMode(false);
    fetchConfig();
  };

  // Calculate preparation time
  const getPreparationInfo = () => {
    if (!config || !prayerTimes) return null;

    const basePrayerTime = prayerTimes[config.base_prayer];
    if (!basePrayerTime) return null;

    const [hours, minutes] = basePrayerTime.split(":").map(Number);
    const prepStart = new Date();
    prepStart.setHours(hours, minutes + config.offset_minutes, 0, 0);

    const prepEnd = new Date(prepStart);
    prepEnd.setMinutes(prepEnd.getMinutes() + config.duration_minutes);

    const currentTime = now.getTime();
    const startTime = prepStart.getTime();
    const endTime = prepEnd.getTime();

    let status: "not_started" | "active" | "closed";
    let remainingMs = 0;

    if (currentTime < startTime) {
      status = "not_started";
      remainingMs = startTime - currentTime;
    } else if (currentTime >= startTime && currentTime <= endTime) {
      status = "active";
      remainingMs = endTime - currentTime;
    } else {
      status = "closed";
      remainingMs = 0;
    }

    return {
      prepStart,
      prepEnd,
      status,
      remainingMs,
      basePrayerLabel: PRAYER_LABELS[config.base_prayer]?.label || config.base_prayer,
      basePrayerTime,
    };
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", hour12: true });
  };

  const formatCountdown = (ms: number) => {
    const totalSecs = Math.floor(ms / 1000);
    const h = Math.floor(totalSecs / 3600);
    const m = Math.floor((totalSecs % 3600) / 60);
    const s = totalSecs % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const STATUS_MAP = {
    not_started: { label: "لم يبدأ", color: "bg-muted text-muted-foreground" },
    active: { label: "جارٍ الآن", color: "bg-green-100 text-green-800" },
    closed: { label: "انتهى", color: "bg-red-100 text-red-800" },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const prepInfo = getPreparationInfo();

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">وقت التحضير</h1>
        <p className="text-muted-foreground text-sm">وقت الاستعداد اليومي بناءً على مواقيت الصلاة</p>
      </div>

      {/* Current Time */}
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-4xl font-bold font-mono tabular-nums">
            {now.toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true })}
          </p>
          {prayerTimes?.hijri_date && (
            <p className="text-sm text-muted-foreground mt-1">{prayerTimes.hijri_date}</p>
          )}
        </CardContent>
      </Card>

      {/* Preparation Status */}
      {prepInfo && (
        <Card className={prepInfo.status === "active" ? "border-green-500 border-2" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              حالة التحضير
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">الحالة</span>
              <Badge className={STATUS_MAP[prepInfo.status].color}>
                {STATUS_MAP[prepInfo.status].label}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">الصلاة الأساسية</span>
              <span className="text-sm font-medium">{prepInfo.basePrayerLabel} ({prepInfo.basePrayerTime})</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">وقت التحضير</span>
              <span className="text-sm font-medium">
                {formatTime(prepInfo.prepStart)} – {formatTime(prepInfo.prepEnd)}
              </span>
            </div>
            {prepInfo.status !== "closed" && (
              <div className="text-center pt-2">
                <p className="text-xs text-muted-foreground mb-1">
                  {prepInfo.status === "not_started" ? "يبدأ بعد" : "ينتهي بعد"}
                </p>
                <p className="text-3xl font-bold font-mono tabular-nums text-primary">
                  {formatCountdown(prepInfo.remainingMs)}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Prayer Times */}
      {prayerTimes && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">مواقيت الصلاة اليوم</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-2">
              {Object.entries(PRAYER_LABELS).map(([key, { label, icon: Icon }]) => (
                <div
                  key={key}
                  className={`text-center p-3 rounded-lg ${
                    config?.base_prayer === key ? "bg-primary/10 border border-primary/30" : "bg-muted/50"
                  }`}
                >
                  <Icon className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-sm font-bold mt-1">{prayerTimes[key] || "—"}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Admin Config */}
      {isManager && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Settings className="w-4 h-4" />
              إعدادات التحضير (للمدير فقط)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!editMode ? (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">الصلاة الأساسية</span>
                  <span>{PRAYER_LABELS[config?.base_prayer]?.label || "—"}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">الإزاحة (دقائق)</span>
                  <span>{config?.offset_minutes || 0} دقيقة بعد الصلاة</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">مدة النافذة</span>
                  <span>{config?.duration_minutes || 0} دقيقة</span>
                </div>
                <Button variant="outline" onClick={() => setEditMode(true)} className="w-full mt-3">
                  تعديل الإعدادات
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-1">
                  <Label>الصلاة الأساسية</Label>
                  <Select value={editForm.base_prayer} onValueChange={(v) => setEditForm({ ...editForm, base_prayer: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(PRAYER_LABELS).map(([key, { label }]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>الإزاحة بعد الصلاة (دقائق)</Label>
                  <Input
                    type="number"
                    value={editForm.offset_minutes}
                    onChange={(e) => setEditForm({ ...editForm, offset_minutes: parseInt(e.target.value) || 0 })}
                    min={0}
                    max={180}
                  />
                </div>
                <div className="space-y-1">
                  <Label>مدة نافذة التحضير (دقائق)</Label>
                  <Input
                    type="number"
                    value={editForm.duration_minutes}
                    onChange={(e) => setEditForm({ ...editForm, duration_minutes: parseInt(e.target.value) || 0 })}
                    min={5}
                    max={120}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSaveConfig} className="flex-1">حفظ</Button>
                  <Button variant="outline" onClick={() => setEditMode(false)} className="flex-1">إلغاء</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default Preparation;
