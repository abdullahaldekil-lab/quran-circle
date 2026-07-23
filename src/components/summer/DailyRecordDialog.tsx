import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { calcNewScore, calcLinkScore, calcTotalScore, type PlanType, type DailyRecordInput } from "@/lib/summer-scoring";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  summerStudentId: string;
  studentName: string;
  planType: PlanType;
  planTrack: string | null;
  defaultReciter: string | null;
  onSaved: () => void;
}

const emptyState = (planType: PlanType, defaultReciter: string | null) => ({
  record_date: new Date().toISOString().slice(0, 10),
  new_from: "", new_to: "",
  new_notifications: 0, new_mistakes_lahn: 0,
  new_listening_done: false, new_repetitions_done: false,
  new_test_score: 0,
  link_from: "", link_to: "",
  link_notifications: 0, link_mistakes_lahn: 0,
  link_pages_count: 0, link_time_per_page: planType === "hifz" ? "1:15" : "",
  link_reciter: defaultReciter || "",
  amyal_score: 0,
  notes: "",
});

export default function DailyRecordDialog({ open, onOpenChange, summerStudentId, studentName, planType, planTrack, defaultReciter, onSaved }: Props) {
  const [state, setState] = useState(emptyState(planType, defaultReciter));
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) setState(emptyState(planType, defaultReciter)); }, [open, planType, defaultReciter]);

  const set = (k: string, v: any) => setState((s) => ({ ...s, [k]: v }));

  const scoring = useMemo<DailyRecordInput>(() => ({
    plan_type: planType,
    new_notifications: Number(state.new_notifications) || 0,
    new_mistakes_lahn: Number(state.new_mistakes_lahn) || 0,
    new_listening_done: state.new_listening_done,
    new_repetitions_done: state.new_repetitions_done,
    new_test_score: Number(state.new_test_score) || 0,
    link_notifications: Number(state.link_notifications) || 0,
    link_mistakes_lahn: Number(state.link_mistakes_lahn) || 0,
    amyal_score: Number(state.amyal_score) || 0,
  }), [state, planType]);

  const newScore = calcNewScore(scoring);
  const linkScore = calcLinkScore(scoring);
  const total = calcTotalScore(scoring);

  const save = async () => {
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const payload: any = {
      summer_student_id: summerStudentId,
      record_date: state.record_date,
      new_from: state.new_from || null,
      new_to: state.new_to || null,
      new_notifications: Number(state.new_notifications) || 0,
      new_mistakes_lahn: Number(state.new_mistakes_lahn) || 0,
      new_listening_done: state.new_listening_done,
      new_repetitions_done: state.new_repetitions_done,
      new_test_score: Number(state.new_test_score) || 0,
      new_score: newScore,
      link_from: state.link_from || null,
      link_to: state.link_to || null,
      link_notifications: Number(state.link_notifications) || 0,
      link_mistakes_lahn: Number(state.link_mistakes_lahn) || 0,
      link_pages_count: Number(state.link_pages_count) || 0,
      link_time_per_page: state.link_time_per_page || null,
      link_reciter: state.link_reciter || null,
      link_score: linkScore,
      amyal_score: Number(state.amyal_score) || 0,
      total_score: total,
      notes: state.notes || null,
      created_by: userData.user?.id || null,
    };
    const { error } = await supabase.from("summer_daily_records").upsert(payload, { onConflict: "summer_student_id,record_date" });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`تم حفظ السجل — المجموع: ${total}/40`);
    onOpenChange(false);
    onSaved();
  };

  const themeClass = planType === "hifz"
    ? "border-rose-300 bg-rose-50/40 dark:bg-rose-950/20"
    : "border-amber-300 bg-amber-50/40 dark:bg-amber-950/20";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{planType === "hifz" ? "بطاقة الحفظ" : "دورة تعاهد"} — {studentName}</span>
            <span className="text-sm font-normal text-muted-foreground">{planTrack || "بدون مسار"}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Label>التاريخ</Label>
            <Input type="date" value={state.record_date} onChange={(e) => set("record_date", e.target.value)} className="w-48" />
          </div>

          {/* Section: New portion */}
          <Card className={themeClass}>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold">المقدار الجديد</h3>
                <span className="text-sm font-semibold">{newScore} / 15</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div><Label className="text-xs">من (رقم الوجه)</Label><Input value={state.new_from} onChange={(e) => set("new_from", e.target.value)} /></div>
                <div><Label className="text-xs">إلى</Label><Input value={state.new_to} onChange={(e) => set("new_to", e.target.value)} /></div>
                <div><Label className="text-xs">عدد التنبيهات</Label><Input type="number" min={0} value={state.new_notifications} onChange={(e) => set("new_notifications", e.target.value)} /></div>
                <div><Label className="text-xs">خطأ / لحن</Label><Input type="number" min={0} value={state.new_mistakes_lahn} onChange={(e) => set("new_mistakes_lahn", e.target.value)} /></div>
              </div>
              {planType === "hifz" ? (
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex items-center gap-2 border rounded p-2">
                    <Switch checked={state.new_listening_done} onCheckedChange={(v) => set("new_listening_done", v)} />
                    <span className="text-sm">الاستماع 3 مرات (5 درجات)</span>
                  </label>
                  <label className="flex items-center gap-2 border rounded p-2">
                    <Switch checked={state.new_repetitions_done} onCheckedChange={(v) => set("new_repetitions_done", v)} />
                    <span className="text-sm">التكرار 25 مرة (5 درجات)</span>
                  </label>
                </div>
              ) : (
                <div>
                  <Label className="text-xs">درجة الاختبار (0-5)</Label>
                  <Input type="number" min={0} max={5} step={0.5} value={state.new_test_score} onChange={(e) => set("new_test_score", e.target.value)} />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Section: Linking on reciter */}
          <Card className={themeClass}>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold">الربط على مقرئ</h3>
                <span className="text-sm font-semibold">{linkScore} / 15</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div><Label className="text-xs">من</Label><Input value={state.link_from} onChange={(e) => set("link_from", e.target.value)} /></div>
                <div><Label className="text-xs">إلى</Label><Input value={state.link_to} onChange={(e) => set("link_to", e.target.value)} /></div>
                <div><Label className="text-xs">عدد التنبيهات</Label><Input type="number" min={0} value={state.link_notifications} onChange={(e) => set("link_notifications", e.target.value)} /></div>
                <div><Label className="text-xs">خطأ / لحن</Label><Input type="number" min={0} value={state.link_mistakes_lahn} onChange={(e) => set("link_mistakes_lahn", e.target.value)} /></div>
                <div><Label className="text-xs">عدد الوجوه</Label><Input type="number" min={0} value={state.link_pages_count} onChange={(e) => set("link_pages_count", e.target.value)} /></div>
                <div><Label className="text-xs">الوقت لكل وجه</Label><Input value={state.link_time_per_page} onChange={(e) => set("link_time_per_page", e.target.value)} placeholder="1:15د" /></div>
                <div className="col-span-2"><Label className="text-xs">المقرئ</Label><Input value={state.link_reciter} onChange={(e) => set("link_reciter", e.target.value)} /></div>
              </div>
            </CardContent>
          </Card>

          {/* Section: Amyal (taahud only) */}
          {planType === "taahud" && (
            <Card className={themeClass}>
              <CardContent className="pt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold">الربط على أميل</h3>
                  <span className="text-sm font-semibold">{Math.min(5, Math.max(0, Number(state.amyal_score) || 0))} / 5</span>
                </div>
                <Input type="number" min={0} max={5} step={0.5} value={state.amyal_score} onChange={(e) => set("amyal_score", e.target.value)} />
              </CardContent>
            </Card>
          )}

          <div>
            <Label>ملاحظات</Label>
            <Textarea value={state.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/30">
            <span className="font-bold">مجموع الدرجات</span>
            <span className="text-2xl font-bold text-primary">{total} / 40</span>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={save} disabled={saving}>{saving ? "جارٍ الحفظ..." : "حفظ السجل"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
