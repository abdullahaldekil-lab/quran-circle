import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  PLAN_TRACKS,
  computeDailyPagesWorking,
  computeWorkingDays,
  juzRangeToPages,
  planDaysNeeded,
  type HolidayRange,
  type PlanType,
} from "@/lib/summer-scoring";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDateTimeSmart, formatDateHijriOnly } from "@/lib/hijri";
import { History, ArrowLeft, User, RefreshCw, AlertTriangle } from "lucide-react";

interface ChangeLog {
  id: string;
  old_plan_type: string | null;
  new_plan_type: string | null;
  old_plan_track: string | null;
  new_plan_track: string | null;
  old_plan_goal: string | null;
  new_plan_goal: string | null;
  old_assigned_reciter: string | null;
  new_assigned_reciter: string | null;
  changed_by_name: string | null;
  created_at: string;
}

const PLAN_LABEL: Record<string, string> = { hifz: "حفظ", taahud: "تعاهد" };

function fieldRow(label: string, oldVal: string | null, newVal: string | null) {
  if ((oldVal || "") === (newVal || "")) return null;
  return (
    <div className="flex items-center gap-2 text-xs flex-wrap">
      <span className="text-muted-foreground min-w-16">{label}:</span>
      <Badge variant="outline" className="text-xs">{oldVal || "—"}</Badge>
      <ArrowLeft className="w-3 h-3 text-muted-foreground rtl:rotate-180" />
      <Badge variant="secondary" className="text-xs">{newVal || "—"}</Badge>
    </div>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  summerStudentId: string;
  studentName: string;
  initial: {
    plan_type?: PlanType | null;
    plan_track?: string | null;
    plan_goal?: string | null;
    assigned_reciter?: string | null;
    juz_from?: number | null;
    juz_to?: number | null;
    plan_start_date?: string | null;
    plan_end_date?: string | null;
  };
  holidays?: HolidayRange[];
  /** Program end date — used as the default plan end (predetermined duration). */
  defaultEndDate?: string | null;
  onSaved: () => void;
}

export default function PlanEditor({ open, onOpenChange, summerStudentId, studentName, initial, holidays = [], defaultEndDate, onSaved }: Props) {
  const [planType, setPlanType] = useState<PlanType>(initial.plan_type || "hifz");
  const [track, setTrack] = useState(initial.plan_track || "");
  const [goal, setGoal] = useState(initial.plan_goal || "");
  const [reciter, setReciter] = useState(initial.assigned_reciter || "");
  const [juzFrom, setJuzFrom] = useState<string>(initial.juz_from ? String(initial.juz_from) : "");
  const [juzTo, setJuzTo] = useState<string>(initial.juz_to ? String(initial.juz_to) : "");
  const [startDate, setStartDate] = useState<string>(initial.plan_start_date || "");
  const [endDate, setEndDate] = useState<string>(initial.plan_end_date || "");
  const [saving, setSaving] = useState(false);
  const [logs, setLogs] = useState<ChangeLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  useEffect(() => {
    setPlanType(initial.plan_type || "hifz");
    setTrack(initial.plan_track || "");
    setGoal(initial.plan_goal || "");
    setReciter(initial.assigned_reciter || "");
    setJuzFrom(initial.juz_from ? String(initial.juz_from) : "");
    setJuzTo(initial.juz_to ? String(initial.juz_to) : "");
    // البدء الافتراضي = يوم الانضمام (اليوم)، والانتهاء = نهاية البرنامج المحددة سلفًا
    setStartDate(initial.plan_start_date || new Date().toISOString().slice(0, 10));
    setEndDate(initial.plan_end_date || defaultEndDate || "");
  }, [summerStudentId, open]);

  useEffect(() => {
    if (!open || !summerStudentId) return;
    setLoadingLogs(true);
    supabase
      .from("summer_plan_change_log" as any)
      .select("*")
      .eq("summer_student_id", summerStudentId)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        setLogs((data as any) || []);
        setLoadingLogs(false);
      });
  }, [summerStudentId, open]);

  const tracks = PLAN_TRACKS[planType];

  const jf = parseInt(juzFrom) || 0;
  const jt = parseInt(juzTo) || 0;
  const preview = useMemo(() => {
    const pages = juzRangeToPages(jf, jt);
    const wd = computeWorkingDays(startDate || null, endDate || null, holidays);
    const daily = computeDailyPagesWorking(pages, wd);
    return { pages, workingDays: wd, daily };
  }, [jf, jt, startDate, endDate, holidays]);

  const rawDaily = preview.pages && preview.workingDays > 0 ? preview.pages / preview.workingDays : 0;
  const overLimit = rawDaily > 20;

  const juzChanged =
    jf !== (initial.juz_from || 0) ||
    jt !== (initial.juz_to || 0) ||
    (startDate || "") !== (initial.plan_start_date || "") ||
    (endDate || "") !== (initial.plan_end_date || "");

  const save = async () => {
    if (preview.pages > 0 && preview.workingDays <= 0) {
      toast.error("حدد تاريخي البدء والانتهاء لاحتساب أيام العمل");
      return;
    }
    setSaving(true);
    const patch: any = {
      plan_type: planType,
      plan_track: track || null,
      plan_goal: goal || null,
      assigned_reciter: reciter || null,
    };
    if (jf > 0 && jt >= jf) {
      patch.juz_from = jf;
      patch.juz_to = jt;
      patch.plan_start_date = startDate || null;
      patch.plan_end_date = endDate || null;
      patch.pages_target = preview.pages;
      patch.working_days = preview.workingDays || null;
      patch.daily_pages = preview.daily;
    }
    const { error } = await supabase.from("summer_students").update(patch).eq("id", summerStudentId);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(
      juzChanged && preview.pages > 0
        ? `تم الحفظ — ${preview.pages} وجه · ${preview.workingDays} يوم عمل · ${preview.daily} وجه/يوم`
        : "تم حفظ الخطة"
    );
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>خطة الطالب — {studentName}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>نوع الخطة</Label>
            <Select value={planType} onValueChange={(v) => { setPlanType(v as PlanType); setTrack(""); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="hifz">حفظ (بطاقة الحفظ)</SelectItem>
                <SelectItem value="taahud">تعاهد / إتقان (دورة تعاهد)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>المسار</Label>
            <Select value={track} onValueChange={setTrack}>
              <SelectTrigger><SelectValue placeholder="اختر المسار" /></SelectTrigger>
              <SelectContent>
                {tracks.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>المقرئ المرافق</Label><Input value={reciter} onChange={(e) => setReciter(e.target.value)} placeholder="اسم المقرئ" /></div>
          <div><Label>هدف الدورة</Label><Textarea value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="سأضبط ..." /></div>

          <div className="border-t pt-3 mt-2">
            <div className="flex items-center gap-2 mb-2">
              <RefreshCw className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">نطاق الحفظ (الأجزاء) — يعيد توليد الخطة والجدول اليومي</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">من الجزء</Label>
                <Input type="number" min={1} max={30} value={juzFrom} onChange={(e) => setJuzFrom(e.target.value)} placeholder="1" />
              </div>
              <div>
                <Label className="text-xs">إلى الجزء</Label>
                <Input type="number" min={1} max={30} value={juzTo} onChange={(e) => setJuzTo(e.target.value)} placeholder="7" />
              </div>
              <div>
                <Label className="text-xs">تاريخ بداية الخطة</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                {startDate && <p className="text-[11px] text-muted-foreground mt-1">{formatDateHijriOnly(startDate)}</p>}
              </div>
              <div>
                <Label className="text-xs">تاريخ نهاية الخطة</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                {endDate && <p className="text-[11px] text-muted-foreground mt-1">{formatDateHijriOnly(endDate)}</p>}
              </div>
            </div>
            {preview.pages > 0 && (
              <div className="flex flex-wrap gap-2 mt-2 bg-muted/40 rounded-md p-2 text-xs">
                <Badge variant="outline">إجمالي: {preview.pages} وجه</Badge>
                <Badge variant="outline">أيام العمل: {preview.workingDays}</Badge>
                <Badge variant="secondary">الحد اليومي: {preview.daily} وجه/يوم</Badge>
                {(() => {
                  const needed = planDaysNeeded(preview.pages, preview.daily);
                  return needed > 0 && needed < preview.workingDays
                    ? <Badge variant="outline" className="border-green-500 text-green-700 dark:text-green-400">تكتمل في {needed} يوم عمل</Badge>
                    : null;
                })()}
                {juzChanged && <Badge className="bg-primary text-primary-foreground">سيُعاد توليد الجدول عند الحفظ</Badge>}
              </div>
            )}
            {preview.pages > 0 && preview.workingDays === 0 && (
              <p className="text-[11px] text-destructive mt-1">حدد تاريخي بداية ونهاية صالحين لحساب أيام العمل.</p>
            )}
            {overLimit && (
              <p className="text-xs text-destructive flex items-center gap-1 mt-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                المطلوب فعليًا {Math.round(rawDaily * 10) / 10} وجه/يوم يتجاوز الحد الأقصى (20). قلّل الأجزاء أو مدّد الفترة.
              </p>
            )}
          </div>

          <div className="border-t pt-3 mt-2">
            <div className="flex items-center gap-2 mb-2">
              <History className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">سجل تغييرات الخطة</span>
              {logs.length > 0 && <Badge variant="outline" className="text-xs">{logs.length}</Badge>}
            </div>
            {loadingLogs ? (
              <p className="text-xs text-muted-foreground text-center py-2">جارٍ التحميل...</p>
            ) : logs.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">لا يوجد تغييرات سابقة</p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                {logs.map((log) => (
                  <div key={log.id} className="bg-muted/30 rounded-md p-2 space-y-1">
                    {fieldRow("النوع", log.old_plan_type ? PLAN_LABEL[log.old_plan_type] || log.old_plan_type : null, log.new_plan_type ? PLAN_LABEL[log.new_plan_type] || log.new_plan_type : null)}
                    {fieldRow("المسار", log.old_plan_track, log.new_plan_track)}
                    {fieldRow("المقرئ", log.old_assigned_reciter, log.new_assigned_reciter)}
                    {fieldRow("الهدف", log.old_plan_goal, log.new_plan_goal)}
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground pt-1">
                      <User className="w-3 h-3" />
                      <span>{log.changed_by_name || "النظام"}</span>
                      <span>•</span>
                      <span>{formatDateTimeSmart(log.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter><Button onClick={save} disabled={saving}>{saving ? "جارٍ الحفظ..." : "حفظ"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
