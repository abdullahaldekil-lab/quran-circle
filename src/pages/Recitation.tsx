import { useEffect, useState } from "react";
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

const Recitation = () => {
  const { user } = useAuth();
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
          setStudents(data || []);
          setCurrentIndex(0);
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

  const handleSave = async () => {
    if (!currentStudent) return;
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


    // تحديث الخطة السنوية للطالب
    if (form.memorized_from && form.memorized_to) {
      const { data: plans } = await supabase
        .from('student_annual_plans')
        .select('id, start_date, daily_memorization_pages, daily_review_pages, daily_linking_pages')
        .eq('student_id', currentStudent.id)
        .eq('status', 'active')
        .limit(1);

      if (plans?.[0]) {
        const planId = plans[0].id;
        const today = new Date();
        const planStart = new Date(plans[0].start_date);
        const monthsDiff = (today.getFullYear() - planStart.getFullYear()) * 12 + (today.getMonth() - planStart.getMonth());
        const monthNumber = Math.max(1, monthsDiff + 1);

        const { data: monthRow } = await supabase
          .from('student_plan_progress')
          .select('id, actual_pages, actual_memorization, actual_review, actual_linking')
          .eq('plan_id', planId)
          .eq('month_number', monthNumber)
          .maybeSingle();

        if (monthRow) {
          const memPages = Number(plans[0].daily_memorization_pages) || 0;
          const revPages = Number(plans[0].daily_review_pages) || 0;
          const linkPages = Number(plans[0].daily_linking_pages) || 0;

          await supabase.from('student_plan_progress').update({
            actual_pages:        (monthRow.actual_pages || 0) + memPages,
            actual_memorization: (monthRow.actual_memorization || 0) + memPages,
            actual_review:       (monthRow.actual_review || 0) + revPages,
            actual_linking:      (monthRow.actual_linking || 0) + linkPages,
          }).eq('id', monthRow.id);
        }
      }
    }

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

  /** Advance student to next part/branch/level automatically */
  const advanceStudentLevel = async (studentId: string) => {
    try {
      const { data: sl } = await supabase.from("student_levels").select("*").eq("student_id", studentId).maybeSingle();
      if (!sl) return;

      const { data: allBranches } = await supabase.from("level_branches").select("*").eq("level_track_id", sl.level_track_id).order("sort_order");
      const { data: allParts } = await supabase.from("level_parts").select("*").eq("branch_id", sl.branch_id).order("sort_order");
      const { data: allTracks } = await supabase.from("level_tracks").select("*").eq("active", true).order("sort_order");

      if (!allBranches || !allParts || !allTracks) return;

      const currentPartIndex = allParts.findIndex(p => p.part_number === sl.part_number);
      
      if (currentPartIndex < allParts.length - 1) {
        // Next part in same branch
        await supabase.from("student_levels").update({
          part_number: allParts[currentPartIndex + 1].part_number,
          updated_by_manager: false,
        }).eq("id", sl.id);
        toast.info("تم الانتقال للجزء التالي تلقائياً");
      } else {
        // Completed all parts in branch, move to next branch
        const currentBranchIndex = allBranches.findIndex(b => b.id === sl.branch_id);
        if (currentBranchIndex < allBranches.length - 1) {
          const nextBranch = allBranches[currentBranchIndex + 1];
          await supabase.from("student_levels").update({
            branch_id: nextBranch.id,
            part_number: 1,
            updated_by_manager: false,
          }).eq("id", sl.id);
          toast.info(`تم الانتقال للفرع ${nextBranch.branch_number} تلقائياً`);
        } else {
          // Completed all branches in level, move to next level
          const currentTrackIndex = allTracks.findIndex(t => t.id === sl.level_track_id);
          if (currentTrackIndex < allTracks.length - 1) {
            const nextTrack = allTracks[currentTrackIndex + 1];
            const { data: nextBranches } = await supabase.from("level_branches").select("*").eq("level_track_id", nextTrack.id).order("sort_order").limit(1);
            await supabase.from("student_levels").update({
              level_track_id: nextTrack.id,
              branch_id: nextBranches?.[0]?.id || null,
              part_number: 1,
              updated_by_manager: false,
              completion_date: null,
            }).eq("id", sl.id);
            toast.success(`🎉 تم الانتقال لمستوى ${nextTrack.name}`);
          } else {
            // All levels completed - graduate
            await supabase.from("student_levels").update({
              completion_date: new Date().toISOString().split("T")[0],
              progress_percentage: 100,
            }).eq("id", sl.id);
            toast.success("🎓 أتم الطالب جميع المستويات - الخريجين!");
          }
        }
      }
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
                <Button variant="ghost" size="icon" disabled={currentIndex >= students.length - 1} onClick={() => { setCurrentIndex(currentIndex + 1); resetForm(); }}>
                  <ChevronRight className="w-5 h-5" />
                </Button>
                <div className="text-center">
                  <h2 className="text-lg font-bold"><StudentNameLink studentId={currentStudent.id} studentName={currentStudent.full_name} /></h2>
                  <p className="text-sm text-muted-foreground">{currentIndex + 1} من {students.length}</p>
                </div>
                <Button variant="ghost" size="icon" disabled={currentIndex <= 0} onClick={() => { setCurrentIndex(currentIndex - 1); resetForm(); }}>
                  <ChevronLeft className="w-5 h-5" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Annual Plan Target — auto-selected mushaf range from daily progress */}
          <StudentAnnualPlanCard
            key={`plan-${currentStudent.id}-${planRefresh}`}
            studentId={currentStudent.id}
            onApply={(from, to) => setForm(prev => ({ ...prev, memorized_from: from, memorized_to: to }))}
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
                          <span className="text-xs text-muted-foreground">
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
                                  <Button type="button" variant="outline" size="icon" className="h-6 w-6" onClick={() => updateCount(sec.key, cat.key, -1)}>
                                    <Minus className="w-3 h-3" />
                                  </Button>
                                  <span className="text-sm font-bold w-5 text-center">{val}</span>
                                  <Button type="button" variant="outline" size="icon" className="h-6 w-6" onClick={() => updateCount(sec.key, cat.key, +1)}>
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
                <span className="w-20 shrink-0 text-sm font-semibold text-foreground pt-2">ملاحظات</span>
                <Textarea placeholder="أضف ملاحظاتك هنا..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="flex-1 text-sm" />
              </div>

              <div className="p-4 space-y-4">
                {/* الدرجة النهائية */}
                <div className="text-center py-4 bg-card rounded-xl border">
                  <p className="text-sm text-muted-foreground">الدرجة النهائية</p>
                  <p className={`text-4xl font-bold ${scoreColor}`}>{totalScore}</p>
                  <p className="text-xs text-muted-foreground">من 100</p>
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
