import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTeacherHalaqat } from "@/hooks/useTeacherHalaqat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { toast } from "sonner";
import { Save, ChevronLeft, ChevronRight, ClipboardList, Mic, History, ChevronDown, ChevronUp, BookOpen, RefreshCw, Link2, Minus, Plus, AlertCircle } from "lucide-react";
import AudioRecorder from "@/components/AudioRecorder";
import { sendNotification } from "@/utils/sendNotification";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import StudentNameLink from "@/components/StudentNameLink";
import { formatDateHijriOnly } from "@/lib/hijri";
import StudentAnnualPlanCard from "@/components/recitation/StudentAnnualPlanCard";
import { filterTahfeezOnly } from "@/lib/halaqaType";
import { emptyBreakdown as sharedEmptyBreakdown, aggregateCounts as sharedAggregate, calcScore as sharedCalcScore } from "@/lib/recitation-scoring";
import { saveRecitationRecord } from "@/lib/recitation-save";
import { MUSHAF_TOTAL_PAGES, parsePageRef } from "@/lib/mushaf";
import { actualPagesFromRecord, commitmentPercentage, monthNumberFor, progressStatus } from "@/lib/planProgress";
import { activePlanFor } from "@/lib/planTerm";
import { useStudentPlan } from "@/hooks/useStudentPlan";
import NoPlanNotice from "@/components/recitation/NoPlanNotice";

const Recitation = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const { filterHalaqat, loading: accessLoading } = useTeacherHalaqat();
  const [halaqat, setHalaqat] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedHalaqa, setSelectedHalaqa] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [planRefresh, setPlanRefresh] = useState(0);
  const [audioUrl, setAudioUrl] = useState("");

  // New per-section error structure: { error, lahn, warning } × { memorization, review, linking }
  const emptyBreakdown = () => sharedEmptyBreakdown();
  const [form, setForm] = useState({
    memorized_from: "",
    memorized_to: "",
    review_from: "",
    review_to: "",
    linking_from: "",
    linking_to: "",
    mistakes_breakdown: emptyBreakdown() as Record<string, Record<string, number>>,
    notes: "",
  });

  // Load halaqat and auto-select teacher's halaqa
  useEffect(() => {
    if (!user || accessLoading) return;
    (supabase as any).from("halaqat_tahfeez").select("*").eq("active", true).then(({ data }: any) => {
      const list = filterHalaqat((data as any[]) || []);
      setHalaqat(list);
      const myHalaqa = list.find(
        (h) => h.teacher_id === user.id || h.assistant_teacher_id === user.id
      );
      if (myHalaqa && !selectedHalaqa) {
        setSelectedHalaqa(myHalaqa.id);
      }
    });
  }, [user, accessLoading]);

  useEffect(() => {
    if (selectedHalaqa) {
      supabase
        .from("students")
        .select("*")
        .eq("halaqa_id", selectedHalaqa)
        .eq("status", "active")
        .order("full_name")
        .then(({ data }) => {
          const list = data || [];
          setStudents(list);
          // Deep link from the teacher dashboard: ?student=<id> opens that student directly
          const target = searchParams.get("student");
          const idx = target ? list.findIndex((s: any) => s.id === target) : -1;
          setCurrentIndex(idx >= 0 ? idx : 0);
          resetForm();
        });
    }
  }, [selectedHalaqa]);

  const resetForm = () => {
    setForm({
      memorized_from: "",
      memorized_to: "",
      review_from: "",
      review_to: "",
      linking_from: "",
      linking_to: "",
      mistakes_breakdown: emptyBreakdown(),
      notes: "",
    });
    setAudioUrl("");
  };

  // Aggregate counters across all sections (delegates to shared util)
  const aggregateCounts = (b: Record<string, Record<string, number>>) => sharedAggregate(b);

  // Deductions: error = 5, lahn = 2, warning = 1 (out of 100)
  const calcScore = () => sharedCalcScore(form.mistakes_breakdown);

  const currentStudent = students[currentIndex];

  const { hasPlan, track, loading: planLoading } = useStudentPlan(currentStudent?.id, planRefresh);

  const handleSave = async () => {
    if (!currentStudent) return;
    if (!hasPlan) {
      toast.error("لا يمكن تسجيل التسميع: الطالب غير مربوط بخطة حفظ");
      return;
    }
    setSaving(true);
    const totalScore = calcScore();
    const result = await saveRecitationRecord(supabase as any, {
      studentId: currentStudent.id,
      halaqaId: selectedHalaqa,
      teacherId: user?.id,
      form,
      audioUrl,
    });
    if (!result.ok) {
      setSaving(false);
      toast.error("حدث خطأ أثناء الحفظ");
      return;
    }


    // تحديث خطة الطالب بما سُمِّع فعلاً
    await updatePlanProgress(currentStudent.id, form);

    // تحديث المحفوظ التراكمي للطالب
    await updateTotalMemorized(currentStudent.id, form);

    // Auto-progress: advance student level if score >= 80
    if (totalScore >= 80) {
      await advanceStudentLevel(currentStudent.id);
    }

    // Send notification to guardians about new recitation
    const { data: guardianLinks } = await supabase.from("guardian_students").select("guardian_id").eq("student_id", currentStudent.id).eq("active", true);
    if (guardianLinks && guardianLinks.length > 0) {
      sendNotification({
        templateCode: "NEW_RECITATION",
        recipientIds: guardianLinks.map((l: any) => l.guardian_id),
        variables: { studentName: currentStudent.full_name, score: String(totalScore) },
      }).catch(console.error);
    }

    setSaving(false);
    toast.success(`تم حفظ تسميع ${currentStudent.full_name} - الدرجة: ${totalScore}`);
    if (currentIndex < students.length - 1) {
      setCurrentIndex(currentIndex + 1);
      resetForm();
    } else {
      resetForm();
    }
    // إعادة حساب بداية/نهاية الجزء تلقائياً بعد تسجيل تقدم اليوم
    setPlanRefresh((n) => n + 1);

  };

  /**
   * Credit the student's plan with the pages ACTUALLY recited.
   *
   * This used to add the planned daily figure on every save regardless of what was
   * recited, so a student who recited half a page got full credit and one who recited
   * three got one. It also silently did nothing when the month row was missing.
   */
  const updatePlanProgress = async (studentId: string, recited: typeof form) => {
    const pages = actualPagesFromRecord(recited);
    if (pages.total <= 0) return;

    const today = new Date().toISOString().split("T")[0];
    const { data: plans } = await supabase
      .from("student_annual_plans")
      .select("id, start_date, end_date, status, term, daily_target_pages, working_days_per_week")
      .eq("student_id", studentId)
      .eq("status", "active");

    const plan = activePlanFor((plans as any[]) || [], today);
    if (!plan) return;

    const monthNumber = monthNumberFor(plan.start_date, today);

    const { data: monthRow } = await supabase
      .from("student_plan_progress")
      .select("id, target_pages, actual_pages, actual_memorization, actual_review, actual_linking")
      .eq("plan_id", plan.id)
      .eq("month_number", monthNumber)
      .maybeSingle();

    const actualPages = (monthRow?.actual_pages || 0) + pages.mem;
    const targetPages = monthRow?.target_pages || 0;
    const pct = commitmentPercentage(actualPages, targetPages);

    const payload = {
      plan_id: plan.id,
      student_id: studentId,
      month_number: monthNumber,
      target_pages: targetPages,
      actual_pages: actualPages,
      actual_memorization: (monthRow?.actual_memorization || 0) + pages.mem,
      actual_review: (monthRow?.actual_review || 0) + pages.rev,
      actual_linking: (monthRow?.actual_linking || 0) + pages.link,
      commitment_percentage: pct,
      status: progressStatus(pct),
    };

    // Upsert rather than update-if-exists: the month row may not have been created
    // when the plan was drawn up, and the old code silently skipped that case.
    await supabase
      .from("student_plan_progress")
      .upsert(payload, { onConflict: "plan_id,month_number" });
  };

  /**
   * Keep `students.total_memorized_pages` current. Nothing wrote to it before, so every
   * "X / 604" bar and the ختم counter were permanently zero.
   */
  const updateTotalMemorized = async (studentId: string, recited: typeof form) => {
    const newEnd = parsePageRef(recited.memorized_to);
    if (newEnd == null) return;

    const [{ data: student }, { data: baseline }] = await Promise.all([
      supabase.from("students").select("total_memorized_pages").eq("id", studentId).maybeSingle(),
      (supabase as any)
        .from("student_memorization_baseline")
        .select("baseline_pages, baseline_up_to_page")
        .eq("student_id", studentId)
        .maybeSingle(),
    ]);

    const basePages = Number(baseline?.baseline_pages) || 0;
    const baseUpTo = Number(baseline?.baseline_up_to_page) || 0;
    // Pages up to the newly recited position, counted once: the baseline covers
    // everything up to its own position, and the rest is what lies beyond it.
    const derived = basePages + Math.max(0, newEnd - Math.max(baseUpTo, 0));
    const next = Math.min(MUSHAF_TOTAL_PAGES, derived);

    // Never move the total backwards — a teacher revisiting an earlier page is
    // reviewing, not un-memorizing.
    if (next <= (student?.total_memorized_pages || 0)) return;

    await supabase.from("students").update({ total_memorized_pages: next }).eq("id", studentId);
  };

  /**
   * الترقية التلقائية داخل برنامج مدارج: عند إتقان التسميع ينتقل الطالب
   * للحزب التالي، والجزء يُحسب تلقائياً (كل جزء = حزبان).
   */
  const advanceStudentLevel = async (studentId: string) => {
    try {
      const { data: en } = await supabase
        .from("madarij_enrollments")
        .select("id, hizb_number, part_number")
        .eq("student_id", studentId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!en) return;

      const currentHizb = Number(en.hizb_number) || 1;
      if (currentHizb >= 60) {
        await supabase
          .from("madarij_enrollments")
          .update({ status: "completed", end_date: new Date().toISOString().split("T")[0] })
          .eq("id", en.id);
        toast.success("🎓 أتم الطالب مسار الحفظ كاملاً في برنامج مدارج");
        return;
      }

      const nextHizb = currentHizb + 1;
      const nextPart = Math.max(1, Math.min(30, Math.ceil(nextHizb / 2)));
      const { error } = await supabase
        .from("madarij_enrollments")
        .update({ hizb_number: nextHizb, part_number: nextPart })
        .eq("id", en.id);
      if (error) throw error;
      toast.info(`تم الانتقال للحزب ${nextHizb} (الجزء ${nextPart}) تلقائياً في برنامج مدارج`);
    } catch (err) {
      console.error("Auto-progress error:", err);
    }
  };


  const totalScore = calcScore();
  const scoreColor = totalScore >= 80 ? "text-success" : totalScore >= 60 ? "text-warning" : "text-destructive";

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">إدخال التسميع</h1>
        <p className="text-muted-foreground text-sm">سجّل تسميع الطلاب اليومي</p>
      </div>

      <div className="space-y-2">
        <Label>اختر الحلقة</Label>
        <Select value={selectedHalaqa} onValueChange={setSelectedHalaqa}>
          <SelectTrigger><SelectValue placeholder="اختر الحلقة" /></SelectTrigger>
          <SelectContent>
            {halaqat.map((h) => (
              <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedHalaqa && students.length > 0 && currentStudent && (
        <>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <Button aria-label="التالي" variant="ghost" size="icon" disabled={currentIndex >= students.length - 1} onClick={() => { setCurrentIndex(currentIndex + 1); resetForm(); }}>
                  <ChevronRight className="w-5 h-5" />
                </Button>
                <div className="text-center">
                  <h2 className="text-lg font-bold"><StudentNameLink studentId={currentStudent.id} studentName={currentStudent.full_name} /></h2>
                  <p className="text-sm text-muted-foreground">{currentIndex + 1} من {students.length}</p>
                  {!planLoading && !hasPlan && (
                    <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                      <AlertCircle className="h-3 w-3" />غير مربوط بمسار حفظ
                    </span>
                  )}
                  {!planLoading && track && (
                    <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                      مسار الحفظ (مدارج): {track.pace_label}
                      {track.hizb_number ? ` • الحزب ${track.hizb_number}` : ""}
                      {track.part_number ? ` • الجزء ${track.part_number}` : ""}
                    </span>
                  )}

                </div>
                <Button aria-label="السابق" variant="ghost" size="icon" disabled={currentIndex <= 0} onClick={() => { setCurrentIndex(currentIndex - 1); resetForm(); }}>
                  <ChevronLeft className="w-5 h-5" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {!planLoading && !hasPlan && (
            <NoPlanNotice studentId={currentStudent.id} studentName={currentStudent.full_name} blocking />
          )}

          {hasPlan && (
          <>
          {/* Annual Plan Target — auto-selected mushaf range from daily progress */}
          <StudentAnnualPlanCard
            key={`plan-${currentStudent.id}-${planRefresh}`}
            studentId={currentStudent.id}
            onApply={(ranges) =>
              setForm(prev => ({
                ...prev,
                memorized_from: ranges.memorized_from,
                memorized_to: ranges.memorized_to,
                // Only fill review/linking when the plan actually suggests them, so an
                // empty suggestion never wipes what the teacher already typed.
                review_from: ranges.review_from || prev.review_from,
                review_to: ranges.review_to || prev.review_to,
                linking_from: ranges.linking_from || prev.linking_from,
                linking_to: ranges.linking_to || prev.linking_to,
              }))
            }
          />


          {/* Student Recitation History */}
          <StudentHistory studentId={currentStudent.id} />

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-primary" />
                بيانات التسميع
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-0">
              {(() => {
                const SECTIONS = [
                  { key: "memorization", title: "الحفظ الجديد", icon: BookOpen, fromKey: "memorized_from", toKey: "memorized_to",
                    wrapper: "border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-800",
                    iconColor: "text-green-600", titleColor: "text-green-800 dark:text-green-300", chipColor: "text-green-700 dark:text-green-300" },
                  { key: "review", title: "المراجعة", icon: RefreshCw, fromKey: "review_from", toKey: "review_to",
                    wrapper: "border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800",
                    iconColor: "text-blue-600", titleColor: "text-blue-800 dark:text-blue-300", chipColor: "text-blue-700 dark:text-blue-300" },
                  { key: "linking", title: "الربط", icon: Link2, fromKey: "linking_from", toKey: "linking_to",
                    wrapper: "border-purple-200 bg-purple-50 dark:bg-purple-950/20 dark:border-purple-800",
                    iconColor: "text-purple-600", titleColor: "text-purple-800 dark:text-purple-300", chipColor: "text-purple-700 dark:text-purple-300" },
                ] as const;
                const CATEGORIES = [
                  { key: "error",   label: "خطأ",  color: "text-red-700" },
                  { key: "lahn",    label: "لحن",  color: "text-orange-700" },
                  { key: "warning", label: "تنبيه", color: "text-amber-700" },
                ] as const;
                const updateCount = (section: string, cat: string, delta: number) => {
                  const cur = form.mistakes_breakdown[section]?.[cat] ?? 0;
                  const next = Math.max(0, cur + delta);
                  const newSec = { ...(form.mistakes_breakdown[section] || { error: 0, lahn: 0, warning: 0 }), [cat]: next };
                  setForm({ ...form, mistakes_breakdown: { ...form.mistakes_breakdown, [section]: newSec } });
                };
                return SECTIONS.map((sec, idx) => {
                  const secCounts = form.mistakes_breakdown[sec.key] || { error: 0, lahn: 0, warning: 0 };
                  const Icon = sec.icon;
                  return (
                    <div key={sec.key} className={`p-4 rounded-lg border space-y-3 ${sec.wrapper} ${idx > 0 ? "mt-3" : ""}`}>
                      <div className="flex items-center gap-2">
                        <Icon className={`w-5 h-5 ${sec.iconColor}`} />
                        <span className={`font-semibold ${sec.titleColor}`}>{sec.title}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Input placeholder="من: سورة / آية" value={(form as any)[sec.fromKey]} onChange={(e) => setForm({ ...form, [sec.fromKey]: e.target.value })} className="text-sm h-9" />
                        <Input placeholder="إلى: سورة / آية" value={(form as any)[sec.toKey]}   onChange={(e) => setForm({ ...form, [sec.toKey]:   e.target.value })} className="text-sm h-9" />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className={`text-sm font-medium ${sec.chipColor}`}>تصنيف الأخطاء</span>
                          <span className="text-xs text-muted-foreground" role="status" aria-live="polite" aria-atomic="true">
                            <span className="sr-only">{sec.title} — </span>
                            المجموع: <span className="font-bold text-destructive">{(secCounts.error || 0) + (secCounts.lahn || 0) + (secCounts.warning || 0)}</span>
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          {CATEGORIES.map((cat) => {
                            const val = secCounts[cat.key] || 0;
                            return (
                              <div key={cat.key} className="flex items-center justify-between gap-2 bg-white dark:bg-background rounded-md px-2 py-1 border">
                                <span className={`text-xs font-medium ${cat.color}`}>{cat.label}</span>
                                <div className="flex items-center gap-1">
                                  <Button aria-label="إنقاص" type="button" variant="outline" size="icon" className="h-6 w-6" onClick={() => updateCount(sec.key, cat.key, -1)}>
                                    <Minus className="w-3 h-3" />
                                  </Button>
                                  <span className="text-sm font-bold w-5 text-center">{val}</span>
                                  <Button aria-label="زيادة" type="button" variant="outline" size="icon" className="h-6 w-6" onClick={() => updateCount(sec.key, cat.key, +1)}>
                                    <Plus className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}



              {/* ملاحظات */}
              <div className="flex items-start gap-3 px-1 py-3">
                <span className="w-20 shrink-0 text-sm font-semibold text-foreground pt-2" id="recitation-notes-label">ملاحظات</span>
                <Textarea aria-labelledby="recitation-notes-label" placeholder="أضف ملاحظاتك هنا..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="flex-1 text-sm" />
              </div>

              <div className="p-4 space-y-4">
                {/* الدرجة النهائية */}
                <div className="text-center py-4 bg-card rounded-xl border" role="status" aria-live="polite" aria-atomic="true">
                  <p className="text-sm text-muted-foreground">الدرجة النهائية</p>
                  <p className={`text-4xl font-bold ${scoreColor}`} aria-hidden="true">{totalScore}</p>
                  <p className="text-xs text-muted-foreground" aria-hidden="true">من 100</p>
                  <span className="sr-only">{totalScore} من 100</span>
                </div>


                {/* Audio Recording */}
                <div className="space-y-2">
                  <Label className="text-xs flex items-center gap-1">
                    <Mic className="w-3 h-3" />
                    تسجيل صوتي
                  </Label>
                  <AudioRecorder
                    onAudioUrl={setAudioUrl}
                    existingUrl={audioUrl}
                    studentId={currentStudent.id}
                    recordDate={new Date().toISOString().split("T")[0]}
                  />
                </div>

                <Button onClick={handleSave} disabled={saving} className="w-full" size="lg">
                  <Save className="w-4 h-4 ml-2" />
                  {saving ? "جارٍ الحفظ..." : "حفظ التسميع والانتقال للتالي"}
                </Button>
              </div>
            </CardContent>
          </Card>
          </>
          )}
        </>
      )}

      {selectedHalaqa && students.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>لا يوجد طلاب في هذه الحلقة</p>
        </div>
      )}
    </div>
  );
};

/** Collapsible history of past recitations for a student (lazy-loaded) */
const StudentHistory = ({ studentId }: { studentId: string }) => {
  const [open, setOpen] = useState(false);
  const [records, setRecords] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Reset when student changes
  useEffect(() => {
    setOpen(false);
    setRecords([]);
    setLoaded(false);
  }, [studentId]);

  // Lazy-load only when opened
  useEffect(() => {
    if (!open || loaded) return;
    supabase
      .from("recitation_records")
      .select("id, record_date, memorized_from, memorized_to, review_from, review_to, total_score, mistakes_count, notes")
      .eq("student_id", studentId)
      .order("record_date", { ascending: false })
      .limit(10)
      .then(({ data }) => {
        setRecords(data || []);
        setLoaded(true);
      });
  }, [open, loaded, studentId]);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors rounded-t-lg">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <History className="w-5 h-5 text-primary" />
                السجل السابق
              </span>
              {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            {!loaded ? (
              <div className="flex justify-center py-4">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : records.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">لا توجد تسميعات سابقة</p>
            ) : (
              <div className="space-y-2">
                {records.map((r) => {
                  const score = Number(r.total_score);
                  const sc = score >= 80 ? "text-success" : score >= 60 ? "text-warning" : "text-destructive";
                  return (
                    <div key={r.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30 border text-sm">
                      <div className="space-y-0.5">
                        <p className="font-medium">{formatDateHijriOnly(r.record_date)}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.memorized_from && r.memorized_to
                            ? `حفظ: ${r.memorized_from} → ${r.memorized_to}`
                            : r.review_from && r.review_to
                            ? `مراجعة: ${r.review_from} → ${r.review_to}`
                            : "—"}
                        </p>
                        {r.notes && <p className="text-xs text-muted-foreground line-clamp-1">{r.notes}</p>}
                      </div>
                      <div className="text-left">
                        <p className={`text-lg font-bold ${sc}`}>{r.total_score ?? "—"}</p>
                        {r.mistakes_count != null && (
                          <p className="text-xs text-muted-foreground">{r.mistakes_count} أخطاء</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

export default Recitation;
