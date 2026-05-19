import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Save, Settings as SettingsIcon } from "lucide-react";
import { toast } from "sonner";

const DEFAULTS = {
  error_deduction: 5,
  lahn_deduction: 2,
  warning_deduction: 1,
  pass_threshold: 60,
  attendance_score: 50,
  narration_max: 50,
};

const FIELDS: { key: keyof typeof DEFAULTS; label: string; hint?: string }[] = [
  { key: "narration_max", label: "درجة السرد القصوى", hint: "إجمالي درجة السرد قبل خصم الأخطاء" },
  { key: "attendance_score", label: "درجة الحضور", hint: "تُضاف على درجة السرد للحصول على المجموع" },
  { key: "pass_threshold", label: "درجة النجاح", hint: "المجموع الأدنى للاجتياز" },
  { key: "error_deduction", label: "خصم الخطأ", hint: "النقاط المخصومة لكل خطأ" },
  { key: "lahn_deduction", label: "خصم اللحن" },
  { key: "warning_deduction", label: "خصم التنبيه" },
];

const NarrationTestSettings = () => {
  const { user } = useAuth();
  const { isManager, isSupervisor } = useRole();
  const canEdit = isManager || isSupervisor;
  const [values, setValues] = useState<any>(DEFAULTS);
  const [recordId, setRecordId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("narration_test_settings")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) {
      setRecordId(data.id);
      setValues({
        error_deduction: Number(data.error_deduction),
        lahn_deduction: Number(data.lahn_deduction),
        warning_deduction: Number(data.warning_deduction),
        pass_threshold: Number(data.pass_threshold),
        attendance_score: Number(data.attendance_score),
        narration_max: Number(data.narration_max),
      });
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    try {
      const payload = { ...values, updated_at: new Date().toISOString(), updated_by: user?.id || null };
      const { error } = recordId
        ? await (supabase as any).from("narration_test_settings").update(payload).eq("id", recordId)
        : await (supabase as any).from("narration_test_settings").insert(payload);
      if (error) throw error;
      toast.success("تم حفظ الإعدادات");
      load();
    } catch (err: any) {
      toast.error("فشل الحفظ: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const total = Number(values.narration_max) + Number(values.attendance_score);

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      <div className="flex items-center gap-2">
        <SettingsIcon className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">إعدادات اختبار السرد</h1>
          <p className="text-sm text-muted-foreground">ضبط طريقة احتساب درجات السرد ومعايير الاجتياز</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">القيم الحالية</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center py-8 text-muted-foreground">جارٍ التحميل...</p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {FIELDS.map((f) => (
                <div key={f.key} className="space-y-1">
                  <Label>{f.label}</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.5"
                    value={values[f.key]}
                    disabled={!canEdit}
                    onChange={(e) => setValues({ ...values, [f.key]: Number(e.target.value) })}
                  />
                  {f.hint && <p className="text-xs text-muted-foreground">{f.hint}</p>}
                </div>
              ))}
            </div>
          )}
          <div className="mt-6 p-3 bg-muted/50 rounded-lg text-sm">
            <span className="font-semibold">المعادلة: </span>
            درجة السرد = {values.narration_max} − (الأخطاء × {values.error_deduction}) − (اللحن × {values.lahn_deduction}) − (التنبيهات × {values.warning_deduction})
            <br />
            <span className="font-semibold">المجموع الأقصى: </span>{total} — <span className="font-semibold">حد النجاح: </span>{values.pass_threshold}
          </div>
          {canEdit && (
            <div className="mt-4 flex justify-end">
              <Button onClick={save} disabled={saving || loading}>
                <Save className="w-4 h-4 ml-1" />
                {saving ? "جارٍ الحفظ..." : "حفظ"}
              </Button>
            </div>
          )}
          {!canEdit && (
            <p className="mt-4 text-xs text-amber-600">للقراءة فقط — يلزم صلاحية المدير أو المشرف للتعديل</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default NarrationTestSettings;
