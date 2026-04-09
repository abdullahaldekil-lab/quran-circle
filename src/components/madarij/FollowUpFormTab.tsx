import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil, Trash2, BookOpen, GraduationCap, Printer } from "lucide-react";
import { toast } from "sonner";
import { formatHijriArabic } from "@/lib/hijri";
import FollowUpPrintTemplate from "./FollowUpPrintTemplate";

interface FollowUpFormTabProps {
  enrollment: any;
  dailyProgress: any[];
  mistakes: any[];
  exams: any[];
  canEdit: boolean;
  onRefresh: () => void;
}

const FollowUpFormTab = ({ enrollment, dailyProgress, mistakes, exams, canEdit, onRefresh }: FollowUpFormTabProps) => {
  const [showPrint, setShowPrint] = useState(false);

  // Daily progress dialog
  const [dpDialogOpen, setDpDialogOpen] = useState(false);
  const [editingDp, setEditingDp] = useState<any>(null);
  const [deleteDpId, setDeleteDpId] = useState<string | null>(null);
  const [dpForm, setDpForm] = useState({
    progress_date: new Date().toISOString().split("T")[0],
    memorization: "",
    listening: 0,
    repetition_before: 0,
    repetition_after: 0,
    grade: 0,
    linking: "",
    mistakes_count: 0,
    review: "",
    execution: "completed" as string,
  });

  // Mistakes dialog
  const [mistakeDialogOpen, setMistakeDialogOpen] = useState(false);
  const [editingMistake, setEditingMistake] = useState<any>(null);
  const [deleteMistakeId, setDeleteMistakeId] = useState<string | null>(null);
  const [mistakeForm, setMistakeForm] = useState({ mistake_text: "", surah: "", ayah: "" });

  // Exam dialog
  const [examDialogOpen, setExamDialogOpen] = useState(false);
  const [examForm, setExamForm] = useState({
    segment1_errors: 0, segment1_warnings: 0,
    segment2_errors: 0, segment2_warnings: 0,
    segment3_errors: 0, segment3_warnings: 0,
    segment4_errors: 0, segment4_warnings: 0,
    segment5_errors: 0, segment5_warnings: 0,
    memorization_grade: 0, extra_points: 0,
    examiner_name: "", supervisor_approval: "", pass_date: "",
    failed_reason: "",
  });

  // --- Computed stats ---
  const daysRequired = (enrollment.madarij_tracks as any)?.days_required || 30;
  const completedDays = dailyProgress.filter(d => d.execution === "completed" || d.execution === "تم").length;
  const remainingDays = Math.max(0, daysRequired - completedDays);
  const progressPercent = Math.min(100, Math.round((completedDays / daysRequired) * 100));
  const avgGrade = useMemo(() => {
    const graded = dailyProgress.filter(d => d.grade != null && d.grade > 0);
    if (graded.length === 0) return 0;
    return Math.round((graded.reduce((s, d) => s + d.grade, 0) / graded.length) * 10) / 10;
  }, [dailyProgress]);
  const totalMistakes = dailyProgress.reduce((s, d) => s + (d.mistakes_count || 0), 0);

  const progressColor = progressPercent >= 80 ? "bg-green-500" : progressPercent >= 50 ? "bg-yellow-500" : "bg-red-500";

  // Auto-calc grade
  const calcGrade = (listening: number, mistakesCount: number) => {
    return Math.max(0, (listening * 1) + (10 - mistakesCount * 2));
  };

  // --- Daily Progress CRUD ---
  const openNewDp = () => {
    const autoMemo = `حزب ${enrollment.hizb_number} — فرع ${enrollment.part_number}`;
    setEditingDp(null);
    setDpForm({
      progress_date: new Date().toISOString().split("T")[0],
      memorization: autoMemo,
      listening: 0, repetition_before: 0, repetition_after: 0,
      grade: 0, linking: "", mistakes_count: 0, review: "",
      execution: "completed",
    });
    setDpDialogOpen(true);
  };

  const openEditDp = (dp: any) => {
    setEditingDp(dp);
    setDpForm({
      progress_date: dp.progress_date,
      memorization: dp.memorization || "",
      listening: dp.listening || 0,
      repetition_before: dp.repetition_before || 0,
      repetition_after: dp.repetition_after || 0,
      grade: dp.grade || 0,
      linking: dp.linking || "",
      mistakes_count: dp.mistakes_count || 0,
      review: dp.review || "",
      execution: dp.execution || "completed",
    });
    setDpDialogOpen(true);
  };

  const handleSaveDp = async (e: React.FormEvent) => {
    e.preventDefault();
    const autoGrade = calcGrade(dpForm.listening, dpForm.mistakes_count);
    const payload = { ...dpForm, grade: autoGrade, enrollment_id: enrollment.id, student_id: enrollment.student_id };
    if (editingDp) {
      const { error } = await supabase.from("madarij_daily_progress").update({ ...dpForm, grade: autoGrade }).eq("id", editingDp.id);
      if (error) { toast.error("خطأ في التعديل"); return; }
      toast.success("تم التعديل");
    } else {
      const { error } = await supabase.from("madarij_daily_progress").insert(payload);
      if (error) { toast.error("خطأ في الإضافة"); return; }
      toast.success("تمت الإضافة");
    }
    setDpDialogOpen(false);
    onRefresh();
  };

  const handleDeleteDp = async () => {
    if (!deleteDpId) return;
    await supabase.from("madarij_daily_progress").delete().eq("id", deleteDpId);
    toast.success("تم الحذف");
    setDeleteDpId(null);
    onRefresh();
  };

  // --- Mistakes CRUD ---
  const openNewMistake = () => {
    setEditingMistake(null);
    setMistakeForm({ mistake_text: "", surah: "", ayah: "" });
    setMistakeDialogOpen(true);
  };

  const handleSaveMistake = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingMistake) {
      await supabase.from("madarij_mistakes").update(mistakeForm).eq("id", editingMistake.id);
      toast.success("تم التعديل");
    } else {
      await supabase.from("madarij_mistakes").insert({ ...mistakeForm, enrollment_id: enrollment.id, student_id: enrollment.student_id });
      toast.success("تمت الإضافة");
    }
    setMistakeDialogOpen(false);
    onRefresh();
  };

  const handleDeleteMistake = async () => {
    if (!deleteMistakeId) return;
    await supabase.from("madarij_mistakes").delete().eq("id", deleteMistakeId);
    toast.success("تم الحذف");
    setDeleteMistakeId(null);
    onRefresh();
  };

  // --- Exam ---
  const segmentGrade = (errors: number, warnings: number) => Math.max(0, 10 - errors * 10 - warnings * 3);

  const examSegmentGrades = useMemo(() => {
    return [1, 2, 3, 4, 5].map(i => {
      const errors = (examForm as any)[`segment${i}_errors`] || 0;
      const warnings = (examForm as any)[`segment${i}_warnings`] || 0;
      return segmentGrade(errors, warnings);
    });
  }, [examForm]);

  const examReviewTotal = examSegmentGrades.reduce((s, g) => s + g, 0);
  const examFinalGrade = examReviewTotal + Number(examForm.memorization_grade) + Number(examForm.extra_points);
  const examPassed = examFinalGrade >= 80 && Number(examForm.memorization_grade) >= 40;

  const handleSaveExam = async (e: React.FormEvent) => {
    e.preventDefault();
    const officialExams = exams.filter(ex => ex.exam_type === 'official');
    const nextAttempt = officialExams.length > 0 ? Math.max(...officialExams.map((ex: any) => ex.attempt_number)) + 1 : 1;

    const payload = {
      ...examForm,
      segment1_grade: examSegmentGrades[0],
      segment2_grade: examSegmentGrades[1],
      segment3_grade: examSegmentGrades[2],
      segment4_grade: examSegmentGrades[3],
      segment5_grade: examSegmentGrades[4],
      review_total: examReviewTotal,
      final_grade: examFinalGrade,
      passed: examPassed,
      enrollment_id: enrollment.id,
      student_id: enrollment.student_id,
      exam_type: 'official',
      attempt_number: nextAttempt,
      failed_reason: !examPassed ? examForm.failed_reason : null,
    };

    const { error } = await supabase.from("madarij_hizb_exams").insert(payload as any);
    if (error) { toast.error("خطأ في حفظ الاختبار"); return; }

    if (examPassed) {
      await supabase.from("madarij_enrollments").update({ status: "completed" } as any).eq("id", enrollment.id);
      toast.success("تم اجتياز الاختبار بنجاح!");
    } else {
      toast.warning("لم يجتز الطالب الاختبار");
    }

    setExamDialogOpen(false);
    onRefresh();
  };

  if (showPrint) {
    return (
      <FollowUpPrintTemplate
        enrollment={enrollment}
        dailyProgress={dailyProgress}
        mistakes={mistakes}
        exam={exams.length > 0 ? exams[0] : null}
        onClose={() => setShowPrint(false)}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Progress Bar & Stats */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">تقدم الخطة</span>
            <span className="text-muted-foreground">{progressPercent}%</span>
          </div>
          <div className="relative h-4 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className={`h-full transition-all ${progressColor}`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-muted p-3 rounded-lg text-center">
              <p className="text-xs text-muted-foreground">الأيام المكتملة</p>
              <p className="text-lg font-bold text-primary">{completedDays}</p>
            </div>
            <div className="bg-muted p-3 rounded-lg text-center">
              <p className="text-xs text-muted-foreground">الأيام المتبقية</p>
              <p className="text-lg font-bold">{remainingDays}</p>
            </div>
            <div className="bg-muted p-3 rounded-lg text-center">
              <p className="text-xs text-muted-foreground">متوسط الدرجة</p>
              <p className="text-lg font-bold">{avgGrade}</p>
            </div>
            <div className="bg-muted p-3 rounded-lg text-center">
              <p className="text-xs text-muted-foreground">إجمالي الأخطاء</p>
              <p className="text-lg font-bold text-destructive">{totalMistakes}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action buttons */}
      <div className="flex flex-wrap gap-2">
        {canEdit && (
          <>
            <Button size="sm" onClick={openNewDp}>
              <Plus className="w-4 h-4 ml-1" />
              تسجيل يوم
            </Button>
            <Button size="sm" variant="outline" onClick={openNewMistake}>
              <BookOpen className="w-4 h-4 ml-1" />
              أخطاء الحزب
            </Button>
            <Button size="sm" variant="outline" onClick={() => setExamDialogOpen(true)}>
              <GraduationCap className="w-4 h-4 ml-1" />
              اختبار الحزب
            </Button>
          </>
        )}
        <Button size="sm" variant="secondary" onClick={() => setShowPrint(true)}>
          <Printer className="w-4 h-4 ml-1" />
          طباعة النموذج
        </Button>
      </div>

      {/* Daily Progress Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">جدول المتابعة اليومية</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>التاريخ</TableHead>
                <TableHead>الحفظ</TableHead>
                <TableHead>الاستماع(٣)</TableHead>
                <TableHead>الربط</TableHead>
                <TableHead>الأخطاء</TableHead>
                <TableHead>تكرار(قبل/بعد)</TableHead>
                <TableHead>المراجعة</TableHead>
                <TableHead>الدرجة</TableHead>
                <TableHead>الحالة</TableHead>
                {canEdit && <TableHead>إجراء</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {dailyProgress.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canEdit ? 10 : 9} className="text-center text-muted-foreground">
                    لا توجد سجلات بعد
                  </TableCell>
                </TableRow>
              ) : dailyProgress.map((dp) => {
                const autoGrade = calcGrade(dp.listening || 0, dp.mistakes_count || 0);
                const displayGrade = dp.grade || autoGrade;
                const status = dp.execution;
                return (
                  <TableRow key={dp.id}>
                    <TableCell className="whitespace-nowrap text-xs">{dp.progress_date}</TableCell>
                    <TableCell className="text-xs">{dp.memorization || "—"}</TableCell>
                    <TableCell>{dp.listening ?? 0}</TableCell>
                    <TableCell className="text-xs">{dp.linking || "—"}</TableCell>
                    <TableCell>{dp.mistakes_count ?? 0}</TableCell>
                    <TableCell>{dp.repetition_before ?? 0}/{dp.repetition_after ?? 0}</TableCell>
                    <TableCell className="text-xs">{dp.review || "—"}</TableCell>
                    <TableCell className="font-medium">{displayGrade}</TableCell>
                    <TableCell>
                      {status === "completed" || status === "تم" ? (
                        <Badge className="bg-green-500/10 text-green-700 border-green-200">مكتمل</Badge>
                      ) : status === "absent" || status === "غياب" ? (
                        <Badge variant="destructive">غياب</Badge>
                      ) : (
                        <Badge variant="secondary">معلق</Badge>
                      )}
                    </TableCell>
                    {canEdit && (
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDp(dp)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteDpId(dp.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ===== DIALOGS ===== */}

      {/* Add/Edit Daily Progress Dialog */}
      <Dialog open={dpDialogOpen} onOpenChange={setDpDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingDp ? "تعديل سجل يومي" : "تسجيل يوم جديد"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveDp} className="space-y-4">
            <div className="space-y-1">
              <Label>التاريخ</Label>
              <Input type="date" value={dpForm.progress_date} onChange={e => setDpForm({ ...dpForm, progress_date: e.target.value })} required />
              <p className="text-xs text-muted-foreground">{formatHijriArabic(dpForm.progress_date)}</p>
            </div>
            <div className="space-y-1">
              <Label>الحفظ</Label>
              <Input value={dpForm.memorization} onChange={e => setDpForm({ ...dpForm, memorization: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>الاستماع (من 3)</Label>
              <Slider
                min={0} max={3} step={1}
                value={[dpForm.listening]}
                onValueChange={v => setDpForm({ ...dpForm, listening: v[0], grade: calcGrade(v[0], dpForm.mistakes_count) })}
              />
              <p className="text-sm text-center font-medium">{dpForm.listening}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>عدد الأخطاء</Label>
                <Input type="number" min={0} value={dpForm.mistakes_count} onChange={e => {
                  const mc = Number(e.target.value);
                  setDpForm({ ...dpForm, mistakes_count: mc, grade: calcGrade(dpForm.listening, mc) });
                }} />
              </div>
              <div className="space-y-1">
                <Label>الدرجة (محسوبة)</Label>
                <Input type="number" value={calcGrade(dpForm.listening, dpForm.mistakes_count)} disabled className="bg-muted" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>التكرار قبل</Label>
                <Input type="number" min={0} value={dpForm.repetition_before} onChange={e => setDpForm({ ...dpForm, repetition_before: Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <Label>التكرار بعد</Label>
                <Input type="number" min={0} value={dpForm.repetition_after} onChange={e => setDpForm({ ...dpForm, repetition_after: Number(e.target.value) })} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>الربط</Label>
              <Input value={dpForm.linking} onChange={e => setDpForm({ ...dpForm, linking: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>المراجعة</Label>
              <Input value={dpForm.review} onChange={e => setDpForm({ ...dpForm, review: e.target.value })} />
            </div>
            <div className="flex items-center gap-6 pt-2">
              <div className="flex items-center gap-2">
                <Switch
                  checked={dpForm.execution === "completed"}
                  onCheckedChange={c => setDpForm({ ...dpForm, execution: c ? "completed" : "absent" })}
                />
                <Label>{dpForm.execution === "completed" ? "تم التنفيذ" : "غياب"}</Label>
              </div>
            </div>
            <Button type="submit" className="w-full">{editingDp ? "حفظ التعديل" : "إضافة"}</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Mistakes Dialog */}
      <Dialog open={mistakeDialogOpen} onOpenChange={setMistakeDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>تدوين أخطاء الحزب</DialogTitle>
          </DialogHeader>
          {/* Existing mistakes list */}
          {mistakes.length > 0 && (
            <div className="max-h-48 overflow-y-auto border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الخطأ</TableHead>
                    <TableHead>السورة</TableHead>
                    <TableHead>الآية</TableHead>
                    {canEdit && <TableHead>حذف</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mistakes.map(m => (
                    <TableRow key={m.id}>
                      <TableCell className="text-xs">{m.mistake_text}</TableCell>
                      <TableCell className="text-xs">{m.surah}</TableCell>
                      <TableCell className="text-xs">{m.ayah}</TableCell>
                      {canEdit && (
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setDeleteMistakeId(m.id)}>
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          {canEdit && (
            <form onSubmit={handleSaveMistake} className="space-y-3 border-t pt-3">
              <p className="text-sm font-medium">إضافة خطأ جديد</p>
              <div className="space-y-1">
                <Label>الخطأ أو اللحن</Label>
                <Input value={mistakeForm.mistake_text} onChange={e => setMistakeForm({ ...mistakeForm, mistake_text: e.target.value })} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>السورة</Label>
                  <Input value={mistakeForm.surah} onChange={e => setMistakeForm({ ...mistakeForm, surah: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label>الآية</Label>
                  <Input value={mistakeForm.ayah} onChange={e => setMistakeForm({ ...mistakeForm, ayah: e.target.value })} />
                </div>
              </div>
              <Button type="submit" size="sm" className="w-full">إضافة</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Exam Dialog */}
      <Dialog open={examDialogOpen} onOpenChange={setExamDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto max-w-lg">
          <DialogHeader>
            <DialogTitle>اختبار نهاية الحزب</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveExam} className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>المقطع</TableHead>
                  <TableHead>الأخطاء</TableHead>
                  <TableHead>التنبيهات</TableHead>
                  <TableHead>الدرجة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[1, 2, 3, 4, 5].map((i) => (
                  <TableRow key={i}>
                    <TableCell>المقطع {i}</TableCell>
                    <TableCell>
                      <Input type="number" min={0} className="w-16 h-8" value={(examForm as any)[`segment${i}_errors`]}
                        onChange={e => setExamForm({ ...examForm, [`segment${i}_errors`]: Number(e.target.value) })} />
                    </TableCell>
                    <TableCell>
                      <Input type="number" min={0} className="w-16 h-8" value={(examForm as any)[`segment${i}_warnings`]}
                        onChange={e => setExamForm({ ...examForm, [`segment${i}_warnings`]: Number(e.target.value) })} />
                    </TableCell>
                    <TableCell className="font-bold">{examSegmentGrades[i - 1]}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>اختبار الحفظ (من 50)</Label>
                <Input type="number" min={0} max={50} value={examForm.memorization_grade}
                  onChange={e => setExamForm({ ...examForm, memorization_grade: Number(e.target.value) })} />
              </div>
              <div className="space-y-1">
                <Label>الدرجات الإضافية</Label>
                <Input type="number" min={0} step={0.5} value={examForm.extra_points}
                  onChange={e => setExamForm({ ...examForm, extra_points: Number(e.target.value) })} />
                <p className="text-xs text-muted-foreground">نصف درجة لكل يوم سبق فيه الخطة</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 bg-muted p-3 rounded-lg">
              <div className="text-center">
                <p className="text-xs text-muted-foreground">مجموع المراجعة</p>
                <p className="text-lg font-bold">{examReviewTotal}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">المجموع النهائي</p>
                <p className="text-lg font-bold text-primary">{examFinalGrade}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">النتيجة</p>
                <Badge variant={examPassed ? "default" : "destructive"} className="mt-1">
                  {examPassed ? "ناجح" : "راسب"}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>اسم المختبر</Label>
                <Input value={examForm.examiner_name} onChange={e => setExamForm({ ...examForm, examiner_name: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>اعتماد الإشراف</Label>
                <Input value={examForm.supervisor_approval} onChange={e => setExamForm({ ...examForm, supervisor_approval: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>تاريخ الاجتياز</Label>
                <Input type="date" value={examForm.pass_date} onChange={e => setExamForm({ ...examForm, pass_date: e.target.value })} />
              </div>
              {!examPassed && (
                <div className="space-y-1">
                  <Label>سبب الرسوب</Label>
                  <Input value={examForm.failed_reason} onChange={e => setExamForm({ ...examForm, failed_reason: e.target.value })} />
                </div>
              )}
            </div>
            <Button type="submit" className="w-full">حفظ الاختبار</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Daily Progress Confirm */}
      <AlertDialog open={!!deleteDpId} onOpenChange={() => setDeleteDpId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>حذف السجل اليومي؟</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteDp} className="bg-destructive text-destructive-foreground">حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Mistake Confirm */}
      <AlertDialog open={!!deleteMistakeId} onOpenChange={() => setDeleteMistakeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>حذف الخطأ؟</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteMistake} className="bg-destructive text-destructive-foreground">حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default FollowUpFormTab;
