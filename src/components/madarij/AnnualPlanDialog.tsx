import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toHijri, formatDateSmart } from "@/lib/hijri";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Target, BookOpen, ChevronLeft, ChevronRight, AlertTriangle, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { PLAN_TERMS, TERM_LABELS, type PlanTerm } from "@/lib/planTerm";
import { filterTahfeezOnly } from "@/lib/halaqaType";
import { validatePlanRanges } from "@/lib/planRanges";
import {
  formatAyahRef,
  searchSurahs,
  segmentFromAyahs,
  segmentFromHizb,
  segmentFromJuz,
  segmentFromPages,
  type SegmentInfo,
} from "@/lib/quran-locate";


interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

interface MonthRow {
  month: number;
  monthName: string;
  workDays: number;
  targetPages: number;
}

type PrevMode = "ayah" | "page" | "juz" | "hizb";

interface PrevRange {
  juz: number | "";
  from: string;
  to: string;
  pages: number;
  /** Which input the teacher is using — the rest is derived automatically. */
  mode: PrevMode;
  /** Raw inputs per mode. */
  aFrom: string;
  aTo: string;
  pFrom: string;
  pTo: string;
  jFrom: string;
  jTo: string;
  hFrom: string;
  hTo: string;
  info: SegmentInfo | null;
}


const PLAN_TYPES = [
  { value: "silver", label: "🥈 المسار الفضي", daily: 0.5, yearly: 100, desc: "نصف وجه يومياً" },
  { value: "gold", label: "🥇 المسار الذهبي", daily: 1, yearly: 200, desc: "وجه كامل يومياً" },
  { value: "custom", label: "⚙️ مخصص", daily: 0, yearly: 0, desc: "هدف يدوي" },
];

const HIJRI_MONTHS = [
  "محرم", "صفر", "ربيع الأول", "ربيع الثاني", "جمادى الأولى", "جمادى الآخرة",
  "رجب", "شعبان", "رمضان", "شوال", "ذو القعدة", "ذو الحجة",
];

const AnnualPlanDialog = ({ open, onOpenChange, onSaved }: Props) => {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [termError, setTermError] = useState(false);

  // Step 1
  const [halaqat, setHalaqat] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedHalaqa, setSelectedHalaqa] = useState("");
  const [selectedStudent, setSelectedStudent] = useState("");
  const [planType, setPlanType] = useState("silver");
  const [term, setTerm] = useState<PlanTerm>("" as unknown as PlanTerm);
  const [customDaily, setCustomDaily] = useState(1);

  // Step 2
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState("");
  const [workingDays, setWorkingDays] = useState(5);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [summary, setSummary] = useState({ totalWorkDays: 0, totalPages: 0, dailyPages: 0 });
  const [dailyMemorization, setDailyMemorization] = useState(0);
  const [dailyReview, setDailyReview] = useState(0);
  const [dailyLinking, setDailyLinking] = useState(0);
  // الحفظ السابق: عدة مواضع (الجزء + من / إلى + عدد الأوجه)
  const [prevRanges, setPrevRanges] = useState<PrevRange[]>([]);
  const prevMemPages = prevRanges.reduce((s, r) => s + (Number(r.pages) || 0), 0);
  const prevMemFrom = prevRanges[0]?.from || "";
  const prevMemTo = prevRanges[prevRanges.length - 1]?.to || "";

  const emptyPrevRange = (): PrevRange => ({
    juz: "", from: "", to: "", pages: 0,
    mode: "ayah", aFrom: "", aTo: "", pFrom: "", pTo: "", jFrom: "", jTo: "", hFrom: "", hTo: "",
    info: null,
  });

  const addPrevRange = () => setPrevRanges(prev => [...prev, emptyPrevRange()]);

  /** Recompute pages/juz/hizb/أوجه from whichever input the teacher filled. */
  const deriveRange = (r: PrevRange): PrevRange => {
    const info =
      r.mode === "ayah" ? segmentFromAyahs(r.aFrom, r.aTo)
      : r.mode === "page" ? segmentFromPages(Number(r.pFrom) || null, Number(r.pTo) || null)
      : r.mode === "juz" ? segmentFromJuz(Number(r.jFrom) || null, Number(r.jTo) || Number(r.jFrom) || null)
      : segmentFromHizb(Number(r.hFrom) || null, Number(r.hTo) || Number(r.hFrom) || null);
    if (!info) return { ...r, info: null, from: "", to: "", juz: "", pages: 0 };
    return {
      ...r,
      info,
      from: formatAyahRef(info.fromRef),
      to: formatAyahRef(info.toRef),
      juz: info.juzFrom,
      pages: info.awjuh,
    };
  };

  const updatePrevRange = (index: number, patch: Partial<PrevRange>) =>
    setPrevRanges(prev => prev.map((r, i) => (i === index ? deriveRange({ ...r, ...patch }) : r)));
  const removePrevRange = (index: number) => setPrevRanges(prev => prev.filter((_, i) => i !== index));


  // Live validation: from <= to, positive pages, and no overlap between segments.
  const rangeValidation = validatePlanRanges(prevRanges);

  // Step 3
  const [monthlyDistribution, setMonthlyDistribution] = useState<MonthRow[]>([]);

  useEffect(() => {
    if (open) {
      setStep(1);
      setTermError(false);
      setPrevRanges([]);
      fetchHalaqat();
      fetchHolidays();
    }
  }, [open]);


  useEffect(() => {
    if (selectedHalaqa) fetchStudents();
  }, [selectedHalaqa]);

  useEffect(() => {
    if (startDate && planType) calculateSummary();
  }, [startDate, endDate, workingDays, planType, customDaily, holidays]);

  const fetchHalaqat = async () => {
    // Memorization plans apply to tahfeez halaqat only — talqeen follows its own curriculum.
    const { data } = await supabase
      .from("halaqat")
      .select("id, name, talqeen_curriculum_id")
      .eq("active", true)
      .order("name");
    setHalaqat(filterTahfeezOnly(data || []));
  };

  const fetchStudents = async () => {
    const { data } = await supabase.from("students").select("id, full_name").eq("halaqa_id", selectedHalaqa).eq("status", "active").order("full_name");
    setStudents(data || []);
  };

  const fetchHolidays = async () => {
    const { data } = await supabase.from("holidays").select("*");
    setHolidays(data || []);
  };

  const getDailyTarget = () => {
    if (planType === "custom") return customDaily;
    return PLAN_TYPES.find(p => p.value === planType)?.daily || 0.5;
  };

  const isHoliday = (date: Date) => {
    const dateStr = date.toISOString().split("T")[0];
    return holidays.some(h => dateStr >= h.start_date && dateStr <= h.end_date);
  };

  const isWeekend = (date: Date) => {
    const day = date.getDay();
    return day === 5 || day === 6; // Friday & Saturday
  };

  const countWorkDays = (from: Date, to: Date) => {
    let count = 0;
    const current = new Date(from);
    while (current <= to) {
      if (!isWeekend(current) && !isHoliday(current)) count++;
      current.setDate(current.getDate() + 1);
    }
    return count;
  };

  const calculateSummary = () => {
    const daily = getDailyTarget();
    const start = new Date(startDate);

    let end: Date;
    if (endDate) {
      end = new Date(endDate);
    } else {
      // Auto-calculate: ~200 working days
      const targetDays = planType === "custom" ? 200 : (PLAN_TYPES.find(p => p.value === planType)?.yearly || 100) / daily;
      end = new Date(start);
      let daysAdded = 0;
      while (daysAdded < targetDays) {
        end.setDate(end.getDate() + 1);
        if (!isWeekend(end) && !isHoliday(end)) daysAdded++;
      }
      setEndDate(end.toISOString().split("T")[0]);
    }

    const totalWorkDays = countWorkDays(start, end);
    const totalPages = Math.round(totalWorkDays * daily);

    setSummary({ totalWorkDays, totalPages, dailyPages: daily });
  };

  const generateMonthlyDistribution = () => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const daily = getDailyTarget();
    const months: MonthRow[] = [];

    const current = new Date(start);
    current.setDate(1);

    let monthIndex = 0;
    while (current <= end) {
      const monthStart = new Date(Math.max(current.getTime(), start.getTime()));
      const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);
      const effectiveEnd = new Date(Math.min(monthEnd.getTime(), end.getTime()));

      const workDays = countWorkDays(monthStart, effectiveEnd);
      const targetPages = Math.round(workDays * daily);

      if (workDays > 0) {
        months.push({
          month: monthIndex + 1,
          monthName: formatDateSmart(current),
          workDays,
          targetPages,
        });
        monthIndex++;
      }

      current.setMonth(current.getMonth() + 1);
      current.setDate(1);
    }

    setMonthlyDistribution(months);
  };

  const handleNext = () => {
    if (step === 1) {
      if (!term || !PLAN_TERMS.includes(term)) {
        setTermError(true);
        toast.error("يرجى اختيار الفصل قبل المتابعة");
        return;
      }
      if (!selectedHalaqa || !selectedStudent) {
        toast.error("يرجى اختيار الحلقة والطالب");
        return;
      }
      setTermError(false);
      calculateSummary();
      setStep(2);
    } else if (step === 2) {
      if (!startDate || !endDate) {
        toast.error("يرجى تحديد التواريخ");
        return;
      }
      if (!rangeValidation.valid) {
        toast.error("يرجى تصحيح مواضع الحفظ السابق قبل المتابعة", { description: rangeValidation.messages.join(" • ") });
        return;
      }
      generateMonthlyDistribution();
      setStep(3);
    }
  };

  const [confirmReplace, setConfirmReplace] = useState(false);

  const handleSave = async () => {
    if (!term || !PLAN_TERMS.includes(term)) {
      setTermError(true);
      toast.error("يرجى اختيار الفصل قبل الحفظ");
      return;
    }
    setTermError(false);
    if (!rangeValidation.valid) {
      toast.error("يرجى تصحيح مواضع الحفظ السابق قبل الحفظ", { description: rangeValidation.messages.join(" • ") });
      setStep(2);
      return;
    }

    // Check for existing active plan
    // Scoped to the same term: creating a summer plan must not be blocked by, or
    // silently replace, the student's annual plan.
    const { data: existingPlans } = await (supabase as any)
      .from("student_annual_plans")
      .select("id")
      .eq("student_id", selectedStudent)
      .eq("status", "active")
      .eq("term", term);

    if (existingPlans && existingPlans.length > 0) {
      setConfirmReplace(true);
      return;
    }

    await doSave();
  };

  const doSave = async () => {
    setSaving(true);
    try {
      // Suspend only the plan for the same term — other terms stay active.
      await (supabase as any)
        .from("student_annual_plans")
        .update({ status: "suspended" })
        .eq("student_id", selectedStudent)
        .eq("status", "active")
        .eq("term", term);

      const { data: plan, error: planError } = await (supabase as any)
        .from("student_annual_plans")
        .insert({
          student_id: selectedStudent,
          halaqa_id: selectedHalaqa,
          academic_year: (() => { const h = toHijri(startDate); return `${h.year}-${h.year + 1}`; })(),
          plan_type: planType,
          term,
          start_date: startDate,
          end_date: endDate,
          total_target_pages: summary.totalPages,
          daily_target_pages: summary.dailyPages,
          working_days_per_week: workingDays,
          daily_memorization_pages: dailyMemorization,
          daily_review_pages: dailyReview,
          daily_linking_pages: dailyLinking,
          previous_memorized_from: prevMemFrom || null,
          previous_memorized_to: prevMemTo || null,
          previous_memorized_pages: prevMemPages,
          previous_memorized_ranges: prevRanges
            .filter(r => r.juz !== "" || r.from || r.to || r.pages)
            .map(r => ({ juz: r.juz === "" ? null : r.juz, from: r.from || null, to: r.to || null, pages: Number(r.pages) || 0 })),
          status: "active",
          created_by: user?.id,
        })
        .select()
        .single();

      if (planError) throw planError;

      // Insert monthly progress rows
      const progressRows = monthlyDistribution.map((m) => ({
        plan_id: plan.id,
        student_id: selectedStudent,
        week_number: 0,
        month_number: m.month,
        target_pages: m.targetPages,
        actual_pages: 0,
        attendance_days: m.workDays,
        commitment_percentage: 0,
        status: "on_track",
      }));

      if (progressRows.length > 0) {
        const { error: progressError } = await supabase
          .from("student_plan_progress")
          .upsert(progressRows, { onConflict: "plan_id,month_number" });
        if (progressError) throw progressError;
      }

      toast.success(`تم حفظ ${TERM_LABELS[term] === "سنوي" ? "الخطة السنوية" : "الخطة الفصلية"} بنجاح`);
      onOpenChange(false);
      onSaved();
    } catch (error: any) {
      toast.error("خطأ في حفظ الخطة: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const updateMonthTarget = (index: number, value: number) => {
    setMonthlyDistribution(prev => prev.map((m, i) => i === index ? { ...m, targetPages: value } : m));
  };

  const totalDistributed = monthlyDistribution.reduce((sum, m) => sum + m.targetPages, 0);

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-primary" />
            إنشاء خطة سنوية — الخطوة {step} من 3
          </DialogTitle>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-2 mb-4">
          {[1, 2, 3].map((s) => (
            <div key={s} className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${s === step ? "bg-primary text-primary-foreground" : s < step ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
              {s}
            </div>
          ))}
        </div>

        {/* Step 1: Select Student & Plan Type */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>الحلقة</Label>
              <Select value={selectedHalaqa} onValueChange={(v) => { setSelectedHalaqa(v); setSelectedStudent(""); }}>
                <SelectTrigger><SelectValue placeholder="اختر الحلقة" /></SelectTrigger>
                <SelectContent>
                  {halaqat.map(h => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>الطالب</Label>
              <Select value={selectedStudent} onValueChange={setSelectedStudent} disabled={!selectedHalaqa}>
                <SelectTrigger><SelectValue placeholder="اختر الطالب" /></SelectTrigger>
                <SelectContent>
                  {students.map(s => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>مدى الخطة <span className="text-destructive">*</span></Label>
              <Select
                value={term}
                onValueChange={(v) => { setTerm(v as PlanTerm); setTermError(false); }}
                aria-invalid={termError}
              >
                <SelectTrigger className={termError ? "border-destructive ring-1 ring-destructive" : ""}>
                  <SelectValue placeholder="اختر الفصل" />
                </SelectTrigger>
                <SelectContent>
                  {PLAN_TERMS.map((t) => (
                    <SelectItem key={t} value={t}>{TERM_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {termError && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> يرجى اختيار الفصل قبل المتابعة
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                يمكن أن تكون للطالب خطة سنوية وخطة فصلية نشطتان معًا — إنشاء خطة فصل لا يوقف الخطة السنوية.
              </p>
            </div>

            <div className="space-y-2">
              <Label>نوع الخطة</Label>
              <div className="grid grid-cols-1 gap-2">
                {PLAN_TYPES.map((pt) => (
                  <Card
                    key={pt.value}
                    className={`cursor-pointer transition-all ${planType === pt.value ? "ring-2 ring-primary bg-primary/5" : "hover:bg-muted/50"}`}
                    onClick={() => setPlanType(pt.value)}
                  >
                    <CardContent className="p-3 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{pt.label}</p>
                        <p className="text-xs text-muted-foreground">{pt.desc}</p>
                      </div>
                      {pt.value !== "custom" && (
                        <Badge variant="secondary">{pt.yearly} وجه/سنة</Badge>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {planType === "custom" && (
              <div className="space-y-2">
                <Label>الهدف اليومي (عدد الأوجه)</Label>
                <Input type="number" min={0.25} step={0.25} value={customDaily} onChange={(e) => setCustomDaily(Number(e.target.value))} />
              </div>
            )}
          </div>
        )}

        {/* Step 2: Configure Plan */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>تاريخ البداية</Label>
                <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setEndDate(""); }} />
              </div>
              <div className="space-y-2">
                <Label>تاريخ النهاية (تلقائي)</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>أيام الدوام في الأسبوع</Label>
              <Select value={String(workingDays)} onValueChange={(v) => setWorkingDays(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[4, 5, 6].map(d => <SelectItem key={d} value={String(d)}>{d} أيام</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Daily breakdown fields */}
            <div className="border-t pt-3">
              <p className="text-sm font-semibold mb-3">التوزيع اليومي (أوجه)</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">الحفظ اليومي</Label>
                  <Input type="number" min={0} step={0.25} value={dailyMemorization} onChange={(e) => setDailyMemorization(Number(e.target.value))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">المراجعة اليومية</Label>
                  <Input type="number" min={0} step={0.25} value={dailyReview} onChange={(e) => setDailyReview(Number(e.target.value))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">الربط اليومي</Label>
                  <Input type="number" min={0} step={0.25} value={dailyLinking} onChange={(e) => setDailyLinking(Number(e.target.value))} />
                </div>
              </div>
            </div>

            {/* Previous memorization — multiple segments */}
            <div className="border-t pt-3">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-semibold">الحفظ السابق (اختياري)</p>
                <Button type="button" size="sm" variant="outline" onClick={addPrevRange} aria-label="إضافة موضع حفظ سابق">
                  <Plus className="w-4 h-4 ml-1" /> إضافة موضع
                </Button>
              </div>

              {rangeValidation.messages.length > 0 && (
                <div className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 p-3">
                  <p className="text-xs font-semibold text-destructive flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    يوجد {rangeValidation.messages.length} خطأ في مواضع الحفظ السابق:
                  </p>
                  <ul className="mt-1 space-y-0.5 pr-4 list-disc text-xs text-destructive">
                    {rangeValidation.messages.map((m, k) => <li key={k}>{m}</li>)}
                  </ul>
                </div>
              )}

              {prevRanges.length === 0 ? (
                <p className="text-xs text-muted-foreground">لا توجد مواضع مسجلة — اضغط «إضافة موضع» لتسجيل أكثر من موضع للحفظ السابق.</p>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    أدخل أي مُدخَل (سورة وآية أو صفحات أو جزء أو حزب) ويكمل البرنامج باقي البيانات آلياً: الصفحات، الجزء، الحزب، وعدد الأوجه.
                  </p>
                  {prevRanges.map((r, i) => (
                    <div key={i} className="space-y-2 p-2 rounded-md bg-muted/40">
                      <div className="grid grid-cols-12 gap-2 items-end">
                        <div className="col-span-3 space-y-1">
                          <Label className="text-xs">طريقة الإدخال</Label>
                          <Select value={r.mode} onValueChange={(v) => updatePrevRange(i, { mode: v as PrevMode })}>
                            <SelectTrigger aria-label="طريقة الإدخال"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ayah">سورة وآية</SelectItem>
                              <SelectItem value="page">أرقام الصفحات</SelectItem>
                              <SelectItem value="juz">الجزء</SelectItem>
                              <SelectItem value="hizb">الحزب</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {r.mode === "ayah" && (
                          <>
                            <div className="col-span-4 space-y-1">
                              <Label className="text-xs">من (سورة وآية)</Label>
                              <Input
                                list={`surahs-${i}`}
                                aria-invalid={["from", "range"].includes(rangeValidation.rowErrors[i]?.field || "")}
                                className={["from", "range"].includes(rangeValidation.rowErrors[i]?.field || "") ? "border-destructive" : ""}
                                placeholder="مثال: البقرة 1"
                                value={r.aFrom}
                                onChange={(e) => updatePrevRange(i, { aFrom: e.target.value })}
                              />
                            </div>
                            <div className="col-span-4 space-y-1">
                              <Label className="text-xs">إلى (سورة وآية)</Label>
                              <Input
                                list={`surahs-${i}`}
                                aria-invalid={["to", "range"].includes(rangeValidation.rowErrors[i]?.field || "")}
                                className={["to", "range"].includes(rangeValidation.rowErrors[i]?.field || "") ? "border-destructive" : ""}
                                placeholder="مثال: البقرة 141"
                                value={r.aTo}
                                onChange={(e) => updatePrevRange(i, { aTo: e.target.value })}
                              />
                            </div>
                            <datalist id={`surahs-${i}`}>
                              {searchSurahs("", 114).map((s) => <option key={s.number} value={`${s.name} 1`} />)}
                            </datalist>
                          </>
                        )}

                        {r.mode === "page" && (
                          <>
                            <div className="col-span-4 space-y-1">
                              <Label className="text-xs">من صفحة</Label>
                              <Input type="number" min={1} max={604} placeholder="1" value={r.pFrom} onChange={(e) => updatePrevRange(i, { pFrom: e.target.value })} />
                            </div>
                            <div className="col-span-4 space-y-1">
                              <Label className="text-xs">إلى صفحة</Label>
                              <Input type="number" min={1} max={604} placeholder="21" value={r.pTo} onChange={(e) => updatePrevRange(i, { pTo: e.target.value })} />
                            </div>
                          </>
                        )}

                        {r.mode === "juz" && (
                          <>
                            <div className="col-span-4 space-y-1">
                              <Label className="text-xs">من الجزء</Label>
                              <Select value={r.jFrom} onValueChange={(v) => updatePrevRange(i, { jFrom: v })}>
                                <SelectTrigger aria-label="من الجزء"><SelectValue placeholder="اختر" /></SelectTrigger>
                                <SelectContent>
                                  {Array.from({ length: 30 }, (_, k) => k + 1).map(j => <SelectItem key={j} value={String(j)}>الجزء {j}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="col-span-4 space-y-1">
                              <Label className="text-xs">إلى الجزء</Label>
                              <Select value={r.jTo} onValueChange={(v) => updatePrevRange(i, { jTo: v })}>
                                <SelectTrigger aria-label="إلى الجزء"><SelectValue placeholder="نفس الجزء" /></SelectTrigger>
                                <SelectContent>
                                  {Array.from({ length: 30 }, (_, k) => k + 1).map(j => <SelectItem key={j} value={String(j)}>الجزء {j}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                          </>
                        )}

                        {r.mode === "hizb" && (
                          <>
                            <div className="col-span-4 space-y-1">
                              <Label className="text-xs">من الحزب</Label>
                              <Input type="number" min={1} max={60} placeholder="1" value={r.hFrom} onChange={(e) => updatePrevRange(i, { hFrom: e.target.value })} />
                            </div>
                            <div className="col-span-4 space-y-1">
                              <Label className="text-xs">إلى الحزب</Label>
                              <Input type="number" min={1} max={60} placeholder="نفس الحزب" value={r.hTo} onChange={(e) => updatePrevRange(i, { hTo: e.target.value })} />
                            </div>
                          </>
                        )}

                        <div className="col-span-1">
                          <Button type="button" size="icon" variant="ghost" onClick={() => removePrevRange(i)} aria-label="حذف الموضع">
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </div>
                      </div>

                      {r.info ? (
                        <div className="flex flex-wrap gap-1.5 text-xs">
                          <Badge variant="secondary">{r.from} → {r.to}</Badge>
                          <Badge variant="outline">صفحة {r.info.fromPage} - {r.info.toPage} ({r.info.pages} صفحة)</Badge>
                          <Badge variant="outline">الجزء {r.info.juzFrom === r.info.juzTo ? r.info.juzFrom : `${r.info.juzFrom}-${r.info.juzTo}`}</Badge>
                          <Badge variant="outline">الحزب {r.info.hizbFrom === r.info.hizbTo ? r.info.hizbFrom : `${r.info.hizbFrom}-${r.info.hizbTo}`}</Badge>
                          <Badge className="bg-primary/10 text-primary border-primary/20">{r.info.awjuh} وجه</Badge>
                        </div>
                      ) : (
                        <p className="text-xs text-muted-foreground">أكمل المُدخلات ليحتسب البرنامج الصفحات والجزء والحزب وعدد الأوجه آلياً.</p>
                      )}

                      {rangeValidation.rowErrors[i] && (
                        <p className="col-span-12 text-xs text-destructive flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 shrink-0" /> {rangeValidation.rowErrors[i].message}
                        </p>
                      )}
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground">
                    إجمالي الأوجه المحفوظة سابقاً: <span className="font-semibold text-foreground">{prevMemPages}</span> وجه
                    {" "}(<span className="font-semibold text-foreground">{prevMemSheets}</span> صفحة • {prevRanges.length} موضع)
                  </p>

                </div>
              )}
            </div>


            <p className="text-xs text-muted-foreground">
              * يتم خصم العطل الرسمية تلقائياً ({holidays.length} عطلة مسجلة)
            </p>

            {/* Summary */}
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-4 space-y-2">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" /> ملخص الخطة
                </h4>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-xl font-bold text-primary">{summary.totalWorkDays}</p>
                    <p className="text-xs text-muted-foreground">أيام العمل</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-primary">{summary.totalPages}</p>
                    <p className="text-xs text-muted-foreground">إجمالي الأوجه</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-primary">{summary.dailyPages}</p>
                    <p className="text-xs text-muted-foreground">أوجه/يوم</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 3: Monthly Distribution */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary" /> التوزيع الشهري
              </h4>
              <Badge variant={totalDistributed === summary.totalPages ? "default" : "destructive"}>
                المجموع: {totalDistributed} / {summary.totalPages}
              </Badge>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>الشهر</TableHead>
                  <TableHead>أيام العمل</TableHead>
                  <TableHead>الأوجه المستهدفة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlyDistribution.map((m, i) => (
                  <TableRow key={i}>
                    <TableCell>{m.month}</TableCell>
                    <TableCell className="font-medium">{m.monthName}</TableCell>
                    <TableCell>{m.workDays}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        className="w-20 h-8"
                        value={m.targetPages}
                        onChange={(e) => updateMonthTarget(i, Number(e.target.value))}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between pt-4 border-t">
          {step > 1 ? (
            <Button variant="outline" onClick={() => setStep(step - 1)}>
              <ChevronRight className="w-4 h-4 ml-1" /> السابق
            </Button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-3">
            {step === 2 && !rangeValidation.valid && rangeValidation.messages.length > 0 && (
              <p className="text-xs text-destructive hidden md:flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 shrink-0" />
                يرجى تصحيح مواضع الحفظ السابق قبل المتابعة
              </p>
            )}
            {step === 3 && !rangeValidation.valid && rangeValidation.messages.length > 0 && (
              <p className="text-xs text-destructive hidden md:flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 shrink-0" />
                يرجى تصحيح مواضع الحفظ السابق قبل الحفظ
              </p>
            )}

            {step < 3 ? (
              <Button onClick={handleNext} disabled={step === 2 && !rangeValidation.valid}>
                التالي <ChevronLeft className="w-4 h-4 mr-1" />
              </Button>
            ) : (
              <Button onClick={handleSave} disabled={saving || !rangeValidation.valid}>
                {saving ? "جارٍ الحفظ..." : "حفظ الخطة"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>

      <AlertDialog open={confirmReplace} onOpenChange={setConfirmReplace}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>يوجد خطة نشطة بالفعل</AlertDialogTitle>
            <AlertDialogDescription>
              يوجد خطة نشطة لهذا الطالب بالفعل — هل تريد إلغاؤها وإنشاء خطة جديدة؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={() => { setConfirmReplace(false); doSave(); }}>
              نعم، استبدل
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default AnnualPlanDialog;
