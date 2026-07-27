import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import {
  calcNewScore, calcLinkScore, calcTotalScore, calcRepetitionScore,
  calcListeningScore, calcPeerLinkScore, evaluateNewPortion, evaluateLink,
  trackRequirement, remedialPlan, isHizbTimeValid,
  MIN_HIZB_MINUTES, PACE_PER_WAJH,
  type PlanType, type DailyRecordInput,
} from "@/lib/summer-scoring";
import { formatDateHijriOnly } from "@/lib/hijri";

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
  listening_count: 0, repetitions_count: 0,
  link_from: "", link_to: "",
  link_notifications: 0, link_mistakes_lahn: 0,
  link_pages_count: 0,
  link_time_per_page: PACE_PER_WAJH[planType],
  link_reciter: defaultReciter || "",
  link_peer_score: 0, link_peer_name: "",
  reading_minutes: "",
  notes: "",
});

export default function DailyRecordDialog({ open, onOpenChange, summerStudentId, studentName, planType, planTrack, defaultReciter, onSaved }: Props) {
  const [state, setState] = useState(emptyState(planType, defaultReciter));
  const [saving, setSaving] = useState(false);

  useEffect(() => { if (open) setState(emptyState(planType, defaultReciter)); }, [open, planType, defaultReciter]);

  const set = (k: string, v: any) => setState((s) => ({ ...s, [k]: v }));

  const req = trackRequirement(planType, planTrack);

  const scoring = useMemo<DailyRecordInput>(() => ({
    plan_type: planType,
    plan_track: planTrack,
    new_notifications: Number(state.new_notifications) || 0,
    new_mistakes_lahn: Number(state.new_mistakes_lahn) || 0,
    link_notifications: Number(state.link_notifications) || 0,
    link_mistakes_lahn: Number(state.link_mistakes_lahn) || 0,
    listening_count: Number(state.listening_count) || 0,
    repetitions_count: Number(state.repetitions_count) || 0,
    link_peer_score: Number(state.link_peer_score) || 0,
  }), [state, planType, planTrack]);

  const newScore = calcNewScore(scoring);
  const linkScore = calcLinkScore(scoring);
  const repScore = calcRepetitionScore(scoring);
  const listenScore = calcListeningScore(scoring);
  const peerScore = calcPeerLinkScore(scoring);
  const total = calcTotalScore(scoring);

  const newOutcome = evaluateNewPortion(planType, scoring.new_notifications, scoring.new_mistakes_lahn);
  const linkOutcome = evaluateLink(planType, scoring.link_notifications, scoring.link_mistakes_lahn);
  const minutes = state.reading_minutes === "" ? null : Number(state.reading_minutes);
  const timeOk = isHizbTimeValid(minutes);

  const save = async () => {
    setSaving(true);
    const { data: userData } = await supabase.auth.getUser();
    const payload: any = {
      summer_student_id: summerStudentId,
      record_date: state.record_date,
      new_from: state.new_from || null,
      new_to: state.new_to || null,
      new_notifications: scoring.new_notifications,
      new_mistakes_lahn: scoring.new_mistakes_lahn,
      new_score: newScore,
      new_passed: newOutcome.passed,
      listening_count: scoring.listening_count,
      repetitions_count: scoring.repetitions_count,
      listening_score: listenScore,
      repetition_score: repScore,
      link_from: state.link_from || null,
      link_to: state.link_to || null,
      link_notifications: scoring.link_notifications,
      link_mistakes_lahn: scoring.link_mistakes_lahn,
      link_pages_count: Number(state.link_pages_count) || 0,
      link_time_per_page: state.link_time_per_page || null,
      link_reciter: state.link_reciter || null,
      link_score: linkScore,
      link_passed: linkOutcome.passed,
      link_peer_score: peerScore,
      link_peer_name: state.link_peer_name || null,
      reading_minutes: minutes,
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

  const outcomeBadge = (o: { passed: boolean; reason: string | null }) =>
    o.passed ? (
      <Badge variant="outline" className="border-green-500 text-green-700 dark:text-green-400 gap-1">
        <CheckCircle2 className="w-3 h-3" />ناجح
      </Badge>
    ) : (
      <Badge variant="destructive" className="gap-1"><AlertTriangle className="w-3 h-3" />راسب</Badge>
    );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2 flex-wrap">
            <span>{planType === "hifz" ? "بطاقة الحفظ" : "دورة تعاهد"} — {studentName}</span>
            <span className="text-sm font-normal text-muted-foreground">{planTrack || "بدون مسار"}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Label>التاريخ</Label>
            <Input type="date" value={state.record_date} onChange={(e) => set("record_date", e.target.value)} className="w-48" />
            {state.record_date && <span className="text-sm text-muted-foreground">{formatDateHijriOnly(state.record_date)}</span>}
            <Badge variant="outline" className="gap-1"><Clock className="w-3 h-3" />التأني: {PACE_PER_WAJH[planType]}د لكل وجه</Badge>
          </div>

          {/* المقدار الجديد */}
          <Card className={themeClass}>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="font-bold">المقدار الجديد</h3>
                <div className="flex items-center gap-2">
                  {outcomeBadge(newOutcome)}
                  <span className="text-sm font-semibold">{newScore} / 15</span>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div><Label className="text-xs">من (رقم الوجه)</Label><Input value={state.new_from} onChange={(e) => set("new_from", e.target.value)} /></div>
                <div><Label className="text-xs">إلى</Label><Input value={state.new_to} onChange={(e) => set("new_to", e.target.value)} /></div>
                <div><Label className="text-xs">خطأ / لحن (−3 لكل)</Label><Input type="number" min={0} value={state.new_mistakes_lahn} onChange={(e) => set("new_mistakes_lahn", e.target.value)} /></div>
                <div>
                  <Label className="text-xs">عدد التنبيهات (−1 لكل)</Label>
                  <Input type="number" min={0} value={state.new_notifications} onChange={(e) => set("new_notifications", e.target.value)} />
                  {planType === "taahud" && <p className="text-[10px] text-muted-foreground mt-1">يُحتسب التنبيه من الثالث</p>}
                </div>
              </div>
              {!newOutcome.passed && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />{newOutcome.reason} — {remedialPlan(planType)}
                </p>
              )}
            </CardContent>
          </Card>

          {/* الاستماع والتكرار */}
          <Card className={themeClass}>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="font-bold">الاستماع والتكرار</h3>
                <span className="text-sm font-semibold">
                  {planType === "hifz" ? `${listenScore + repScore} / 10` : `${repScore} / 5`}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">مرات التكرار (المطلوب {req.repetitions} — 5 درجات)</Label>
                  <Input type="number" min={0} value={state.repetitions_count} onChange={(e) => set("repetitions_count", e.target.value)} />
                  <p className="text-[11px] text-muted-foreground mt-1">درجة التكرار: {repScore} / 5</p>
                </div>
                <div>
                  <Label className="text-xs">
                    مرات الاستماع من قارئ مجوّد (المطلوب {req.listening}
                    {planType === "hifz" ? " — 5 درجات" : ""})
                  </Label>
                  <Input type="number" min={0} value={state.listening_count} onChange={(e) => set("listening_count", e.target.value)} />
                  {planType === "hifz" && <p className="text-[11px] text-muted-foreground mt-1">درجة الاستماع: {listenScore} / 5</p>}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* الربط على مقرئ */}
          <Card className={themeClass}>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h3 className="font-bold">الربط على مقرئ</h3>
                <div className="flex items-center gap-2">
                  {outcomeBadge(linkOutcome)}
                  <span className="text-sm font-semibold">{linkScore} / 15</span>
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div><Label className="text-xs">من</Label><Input value={state.link_from} onChange={(e) => set("link_from", e.target.value)} /></div>
                <div><Label className="text-xs">إلى</Label><Input value={state.link_to} onChange={(e) => set("link_to", e.target.value)} /></div>
                <div><Label className="text-xs">خطأ / لحن (−3 لكل)</Label><Input type="number" min={0} value={state.link_mistakes_lahn} onChange={(e) => set("link_mistakes_lahn", e.target.value)} /></div>
                <div><Label className="text-xs">عدد التنبيهات (−1 لكل)</Label><Input type="number" min={0} value={state.link_notifications} onChange={(e) => set("link_notifications", e.target.value)} /></div>
                <div><Label className="text-xs">عدد الأوجه</Label><Input type="number" min={0} value={state.link_pages_count} onChange={(e) => set("link_pages_count", e.target.value)} /></div>
                <div><Label className="text-xs">الوقت لكل وجه</Label><Input value={state.link_time_per_page} onChange={(e) => set("link_time_per_page", e.target.value)} placeholder={PACE_PER_WAJH[planType]} /></div>
                <div>
                  <Label className="text-xs">زمن قراءة الحزب (دقيقة)</Label>
                  <Input type="number" min={0} value={state.reading_minutes} onChange={(e) => set("reading_minutes", e.target.value)} placeholder={`${MIN_HIZB_MINUTES}+`} />
                </div>
                <div><Label className="text-xs">المقرئ</Label><Input value={state.link_reciter} onChange={(e) => set("link_reciter", e.target.value)} /></div>
              </div>
              {!timeOk && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />زمن الحزب أقل من {MIN_HIZB_MINUTES} دقيقة — تلزم إعادة الحزب.
                </p>
              )}
              {!linkOutcome.passed && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />{linkOutcome.reason}
                </p>
              )}
            </CardContent>
          </Card>

          {/* الربط على زميل — التعاهد فقط */}
          {planType === "taahud" && (
            <Card className={themeClass}>
              <CardContent className="pt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold">الربط على زميل</h3>
                  <span className="text-sm font-semibold">{peerScore} / 5</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">الدرجة (0-5)</Label><Input type="number" min={0} max={5} step={0.5} value={state.link_peer_score} onChange={(e) => set("link_peer_score", e.target.value)} /></div>
                  <div><Label className="text-xs">اسم الزميل</Label><Input value={state.link_peer_name} onChange={(e) => set("link_peer_name", e.target.value)} /></div>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  مقدار الربط: آخر خمسة أيام على مقرئ، والخمسة التي قبلها على زميل، وما قبلها يقرؤه ذاتياً.
                </p>
              </CardContent>
            </Card>
          )}

          <div>
            <Label htmlFor="summer-notes">ملاحظات</Label>
            <Textarea id="summer-notes" value={state.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-primary/10 border border-primary/30" role="status" aria-live="polite" aria-atomic="true">
            <span className="font-bold">مجموع الدرجات</span>
            <span className="text-2xl font-bold text-primary" aria-hidden="true">{total} / 40</span>
            <span className="sr-only">{total} من 40</span>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={save} disabled={saving}>{saving ? "جارٍ الحفظ..." : "حفظ السجل"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
