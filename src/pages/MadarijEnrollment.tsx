import { useEffect, useState } from "react";
import StudentNameLink from "@/components/StudentNameLink";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ArrowRight, Plus, Pencil, Trash2, Printer, AlertTriangle, FlaskConical } from "lucide-react";
import { useRole } from "@/hooks/useRole";
import { toast } from "sonner";
import MadarijPrintTemplate from "@/components/MadarijPrintTemplate";
import FollowUpFormTab from "@/components/madarij/FollowUpFormTab";

const MadarijEnrollment = () => {
  const { enrollmentId } = useParams<{ enrollmentId: string }>();
  const navigate = useNavigate();
  const { isManager, isTeacher } = useRole();
  const canEdit = isManager || isTeacher;

  const [enrollment, setEnrollment] = useState<any>(null);
  const [dailyProgress, setDailyProgress] = useState<any[]>([]);
  const [mistakes, setMistakes] = useState<any[]>([]);
  const [exams, setExams] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPrint, setShowPrint] = useState(false);
  const [levelDowngradeAlert, setLevelDowngradeAlert] = useState(false);

  // Daily progress form
  const [dpDialogOpen, setDpDialogOpen] = useState(false);
  const [editingDp, setEditingDp] = useState<any>(null);
  const [deleteDpId, setDeleteDpId] = useState<string | null>(null);
  const [dpForm, setDpForm] = useState({
    progress_date: new Date().toISOString().split("T")[0],
    memorization: "", listening: 0, repetition_before: 0, repetition_after: 0,
    grade: 0, linking: "", mistakes_count: 0, review: "", execution: "",
  });

  // Mistakes form
  const [mistakeDialogOpen, setMistakeDialogOpen] = useState(false);
  const [editingMistake, setEditingMistake] = useState<any>(null);
  const [deleteMistakeId, setDeleteMistakeId] = useState<string | null>(null);
  const [mistakeForm, setMistakeForm] = useState({ mistake_text: "", surah: "", ayah: "" });

  // Exam form
  const [examDialogOpen, setExamDialogOpen] = useState(false);
  const [examDialogType, setExamDialogType] = useState<'official' | 'trial'>('official');
  const [examForm, setExamForm] = useState({
    segment1_errors: 0, segment1_warnings: 0, segment1_grade: 0,
    segment2_errors: 0, segment2_warnings: 0, segment2_grade: 0,
    segment3_errors: 0, segment3_warnings: 0, segment3_grade: 0,
    segment4_errors: 0, segment4_warnings: 0, segment4_grade: 0,
    segment5_errors: 0, segment5_warnings: 0, segment5_grade: 0,
    review_total: 0, memorization_grade: 0, extra_points: 0, final_grade: 0,
    examiner_name: "", supervisor_approval: "", pass_date: "", passed: false,
    failed_reason: "",
  });

  // Computed values
  const failedAttempts = exams.filter(e => !e.passed && e.exam_type === 'official').length;
  const latestExam = exams.length > 0 ? exams[0] : null;

  const fetchAll = async () => {
    if (!enrollmentId) return;
    setLoading(true);
    const [enrollRes, dpRes, mistakesRes, examsRes] = await Promise.all([
      supabase.from("madarij_enrollments").select("*, students(full_name, halaqat(name)), madarij_tracks!madarij_enrollments_track_id_fkey(name, days_required), level_tracks(name)").eq("id", enrollmentId).maybeSingle(),
      supabase.from("madarij_daily_progress").select("*").eq("enrollment_id", enrollmentId).order("progress_date"),
      supabase.from("madarij_mistakes").select("*").eq("enrollment_id", enrollmentId).order("created_at"),
      supabase.from("madarij_hizb_exams").select("*").eq("enrollment_id", enrollmentId).order("attempt_number", { ascending: false }),
    ]);
    setEnrollment(enrollRes.data);
    setDailyProgress(dpRes.data || []);
    setMistakes(mistakesRes.data || []);
    setExams(examsRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, [enrollmentId]);

  // Daily Progress CRUD
  const openNewDp = () => {
    setEditingDp(null);
    setDpForm({ progress_date: new Date().toISOString().split("T")[0], memorization: "", listening: 0, repetition_before: 0, repetition_after: 0, grade: 0, linking: "", mistakes_count: 0, review: "", execution: "" });
    setDpDialogOpen(true);
  };

  const openEditDp = (dp: any) => {
    setEditingDp(dp);
    setDpForm({
      progress_date: dp.progress_date, memorization: dp.memorization || "", listening: dp.listening || 0,
      repetition_before: dp.repetition_before || 0, repetition_after: dp.repetition_after || 0,
      grade: dp.grade || 0, linking: dp.linking || "", mistakes_count: dp.mistakes_count || 0,
      review: dp.review || "", execution: dp.execution || "",
    });
    setDpDialogOpen(true);
  };

  const handleSaveDp = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...dpForm, enrollment_id: enrollmentId, student_id: enrollment.student_id };
    if (editingDp) {
      const { error } = await supabase.from("madarij_daily_progress").update(dpForm).eq("id", editingDp.id);
      if (error) { toast.error("خطأ"); return; }
      toast.success("تم التعديل");
    } else {
      const { error } = await supabase.from("madarij_daily_progress").insert(payload);
      if (error) { toast.error("خطأ"); return; }
      toast.success("تمت الإضافة");
    }
    setDpDialogOpen(false);
    fetchAll();
  };

  const handleDeleteDp = async () => {
    if (!deleteDpId) return;
    await supabase.from("madarij_daily_progress").delete().eq("id", deleteDpId);
    toast.success("تم الحذف");
    setDeleteDpId(null);
    fetchAll();
  };

  // Mistakes CRUD
  const openNewMistake = () => {
    setEditingMistake(null);
    setMistakeForm({ mistake_text: "", surah: "", ayah: "" });
    setMistakeDialogOpen(true);
  };

  const openEditMistake = (m: any) => {
    setEditingMistake(m);
    setMistakeForm({ mistake_text: m.mistake_text, surah: m.surah || "", ayah: m.ayah || "" });
    setMistakeDialogOpen(true);
  };

  const handleSaveMistake = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingMistake) {
      await supabase.from("madarij_mistakes").update(mistakeForm).eq("id", editingMistake.id);
      toast.success("تم التعديل");
    } else {
      await supabase.from("madarij_mistakes").insert({ ...mistakeForm, enrollment_id: enrollmentId, student_id: enrollment.student_id });
      toast.success("تمت الإضافة");
    }
    setMistakeDialogOpen(false);
    fetchAll();
  };

  const handleDeleteMistake = async () => {
    if (!deleteMistakeId) return;
    await supabase.from("madarij_mistakes").delete().eq("id", deleteMistakeId);
    toast.success("تم الحذف");
    setDeleteMistakeId(null);
    fetchAll();
  };

  // Exam CRUD
  const openExamForm = (type: 'official' | 'trial') => {
    setExamDialogType(type);
    setExamForm({
      segment1_errors: 0, segment1_warnings: 0, segment1_grade: 0,
      segment2_errors: 0, segment2_warnings: 0, segment2_grade: 0,
      segment3_errors: 0, segment3_warnings: 0, segment3_grade: 0,
      segment4_errors: 0, segment4_warnings: 0, segment4_grade: 0,
      segment5_errors: 0, segment5_warnings: 0, segment5_grade: 0,
      review_total: 0, memorization_grade: 0, extra_points: 0, final_grade: 0,
      examiner_name: "", supervisor_approval: "", pass_date: "", passed: false,
      failed_reason: "",
    });
    setExamDialogOpen(true);
  };

  const handleSaveExam = async (e: React.FormEvent) => {
    e.preventDefault();
    const reviewTotal = examForm.segment1_grade + examForm.segment2_grade + examForm.segment3_grade + examForm.segment4_grade + examForm.segment5_grade;
    const finalGrade = reviewTotal + Number(examForm.memorization_grade) + Number(examForm.extra_points);
    const passed = finalGrade >= 40;

    // Calculate attempt number for the current type
    const sameTypeExams = exams.filter(ex => ex.exam_type === examDialogType);
    const nextAttempt = sameTypeExams.length > 0 ? Math.max(...sameTypeExams.map((ex: any) => ex.attempt_number)) + 1 : 1;

    const payload = {
      ...examForm,
      review_total: reviewTotal,
      final_grade: finalGrade,
      passed,
      enrollment_id: enrollmentId,
      student_id: enrollment.student_id,
      exam_type: examDialogType,
      attempt_number: nextAttempt,
      failed_reason: !passed ? examForm.failed_reason : null,
    };

    const { error } = await supabase.from("madarij_hizb_exams").insert(payload as any);
    if (error) { toast.error("خطأ في حفظ الاختبار"); return; }

    // Official exam logic
    if (examDialogType === 'official') {
      if (passed) {
        await supabase.from("madarij_enrollments").update({ status: "completed" } as any).eq("id", enrollmentId);
        toast.success("تم اجتياز الاختبار وإكمال التسجيل!");
      } else {
        // Handle failure
        const newFailed = failedAttempts + 1;
        await supabase.from("madarij_enrollments").update({ failed_attempts: newFailed } as any).eq("id", enrollmentId);

        if (newFailed >= 2) {
          // Level downgrade logic
          const currentTrack = enrollment.madarij_tracks as any;
          const { data: lowerTrack } = await supabase
            .from("madarij_tracks")
            .select("*")
            .lt("days_required", currentTrack.days_required)
            .eq("active", true)
            .order("days_required", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (lowerTrack) {
            // Update enrollment
            await supabase.from("madarij_enrollments").update({
              track_id: lowerTrack.id,
              level_downgraded: true,
              previous_track_id: enrollment.track_id,
              failed_attempts: 0,
            } as any).eq("id", enrollmentId);

            // Log level change
            const { data: { user } } = await supabase.auth.getUser();
            await supabase.from("madarij_level_changes" as any).insert({
              student_id: enrollment.student_id,
              enrollment_id: enrollmentId,
              old_track_id: enrollment.track_id,
              new_track_id: lowerTrack.id,
              reason: `رسوب في الاختبار الرسمي ${newFailed} مرات`,
              changed_by: user?.id,
            });

            // Send notification to guardian
            const { data: guardianLinks } = await supabase
              .from("guardian_students")
              .select("guardian_id")
              .eq("student_id", enrollment.student_id)
              .eq("active", true);

            if (guardianLinks && guardianLinks.length > 0) {
              const studentName = (enrollment.students as any)?.full_name || "الطالب";
              const notifs = guardianLinks.map((gl: any) => ({
                user_id: gl.guardian_id,
                title: "تغيير مستوى في برنامج مدارج",
                body: `تم نقل ${studentName} من مسار ${currentTrack.name} إلى مسار ${lowerTrack.name} بسبب عدم اجتياز الاختبار`,
                channel: "inApp",
                status: "sent",
              }));
              await supabase.from("notifications").insert(notifs);
            }

            toast.error("تم نزول الطالب للمستوى الأدنى تلقائياً بعد رسوبين");
            setLevelDowngradeAlert(true);
          } else {
            toast.warning("الطالب في أدنى مستوى متاح — يرجى مراجعة المشرف");
          }
        } else {
          toast.warning("لم يجتز الطالب الاختبار — المحاولة " + newFailed + " من 2");
        }
      }
    } else {
      toast.success("تم حفظ الاختبار التجريبي");
    }

    setExamDialogOpen(false);
    fetchAll();
  };

  if (loading || !enrollment) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (showPrint) {
    return (
      <MadarijPrintTemplate
        enrollment={enrollment}
        dailyProgress={dailyProgress}
        mistakes={mistakes}
        exam={latestExam}
        onClose={() => setShowPrint(false)}
      />
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
          <ArrowRight className="w-4 h-4 ml-1" />
          رجوع
        </Button>
        <Button variant="outline" size="sm" onClick={() => setShowPrint(true)}>
          <Printer className="w-4 h-4 ml-1" />
          طباعة النموذج
        </Button>
      </div>

      {/* Level Downgrade Alert */}
      {enrollment.level_downgraded && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            تم خفض مستوى الطالب بعد رسوبين متتاليين في الاختبار الرسمي
          </AlertDescription>
        </Alert>
      )}

      {/* Enrollment Info */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div><span className="text-muted-foreground">الطالب:</span> <strong><StudentNameLink studentId={enrollment.student_id} studentName={(enrollment.students as any)?.full_name || "—"} /></strong></div>
            <div><span className="text-muted-foreground">المسار:</span> <strong>{(enrollment.madarij_tracks as any)?.name}</strong></div>
            <div><span className="text-muted-foreground">الجزء:</span> <strong>{enrollment.part_number}</strong></div>
            <div><span className="text-muted-foreground">الحزب:</span> <strong>{enrollment.hizb_number}</strong></div>
            <div><span className="text-muted-foreground">تاريخ البداية:</span> <strong>{enrollment.start_date}</strong></div>
            <div><span className="text-muted-foreground">تاريخ النهاية:</span> <strong>{enrollment.end_date || "—"}</strong></div>
            <div><span className="text-muted-foreground">الأيام:</span> <strong>{(enrollment.madarij_tracks as any)?.days_required} يوم</strong></div>
            <div className="flex items-center gap-2">
              <Badge variant={enrollment.status === "active" ? "default" : "secondary"}>
                {enrollment.status === "active" ? "نشط" : "مكتمل"}
              </Badge>
              {failedAttempts > 0 && (
                <Badge variant="destructive" className="text-xs">
                  رسوب: {failedAttempts}
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="followup" dir="rtl">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="followup">نموذج المتابعة</TabsTrigger>
          <TabsTrigger value="daily">المتابعة اليومية</TabsTrigger>
          <TabsTrigger value="mistakes">تدوين الأخطاء</TabsTrigger>
          <TabsTrigger value="exam">اختبار نهاية الحزب</TabsTrigger>
        </TabsList>

        {/* Follow-up Form Tab */}
        <TabsContent value="followup">
          <FollowUpFormTab
            enrollment={enrollment}
            dailyProgress={dailyProgress}
            mistakes={mistakes}
            exams={exams}
            canEdit={canEdit}
            onRefresh={fetchAll}
          />
        </TabsContent>

        {/* Daily Progress Tab */}
        <TabsContent value="daily">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">المتابعة اليومية</CardTitle>
              {canEdit && (
                <Button size="sm" onClick={openNewDp}>
                  <Plus className="w-4 h-4 ml-1" />
                  إضافة
                </Button>
              )}
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>الحفظ</TableHead>
                    <TableHead>الاستماع</TableHead>
                    <TableHead>تكرار قبل</TableHead>
                    <TableHead>تكرار بعد</TableHead>
                    <TableHead>الدرجة</TableHead>
                    <TableHead>الربط</TableHead>
                    <TableHead>الأخطاء</TableHead>
                    <TableHead>المراجعة</TableHead>
                    <TableHead>التنفيذ</TableHead>
                    {canEdit && <TableHead>إجراء</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dailyProgress.length === 0 ? (
                    <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground">لا توجد سجلات</TableCell></TableRow>
                  ) : dailyProgress.map((dp) => (
                    <TableRow key={dp.id}>
                      <TableCell className="whitespace-nowrap">{dp.progress_date}</TableCell>
                      <TableCell>{dp.memorization}</TableCell>
                      <TableCell>{dp.listening}</TableCell>
                      <TableCell>{dp.repetition_before}</TableCell>
                      <TableCell>{dp.repetition_after}</TableCell>
                      <TableCell>{dp.grade}</TableCell>
                      <TableCell>{dp.linking}</TableCell>
                      <TableCell>{dp.mistakes_count}</TableCell>
                      <TableCell>{dp.review}</TableCell>
                      <TableCell>{dp.execution}</TableCell>
                      {canEdit && (
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDp(dp)}><Pencil className="w-3.5 h-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteDpId(dp.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Mistakes Tab */}
        <TabsContent value="mistakes">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">تدوين الأخطاء والألحان</CardTitle>
              {canEdit && (
                <Button size="sm" onClick={openNewMistake}>
                  <Plus className="w-4 h-4 ml-1" />
                  إضافة
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الخطأ أو اللحن</TableHead>
                    <TableHead>السورة</TableHead>
                    <TableHead>الآية</TableHead>
                    {canEdit && <TableHead>إجراء</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mistakes.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">لا توجد أخطاء مسجلة</TableCell></TableRow>
                  ) : mistakes.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell>{m.mistake_text}</TableCell>
                      <TableCell>{m.surah}</TableCell>
                      <TableCell>{m.ayah}</TableCell>
                      {canEdit && (
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditMistake(m)}><Pencil className="w-3.5 h-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteMistakeId(m.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Exam Tab */}
        <TabsContent value="exam">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">اختبار نهاية الحزب</CardTitle>
              {canEdit && (
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => openExamForm('official')}>
                    <Plus className="w-4 h-4 ml-1" />
                    إضافة اختبار
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => openExamForm('trial')}>
                    <FlaskConical className="w-4 h-4 ml-1" />
                    اختبار تجريبي
                  </Button>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Latest exam details */}
              {latestExam && (
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-muted-foreground">
                    آخر اختبار — {latestExam.exam_type === 'trial' ? 'تجريبي' : 'رسمي'}
                  </h4>
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
                      {[1,2,3,4,5].map((i) => (
                        <TableRow key={i}>
                          <TableCell>المقطع {i}</TableCell>
                          <TableCell>{(latestExam as any)[`segment${i}_errors`]}</TableCell>
                          <TableCell>{(latestExam as any)[`segment${i}_warnings`]}</TableCell>
                          <TableCell>{(latestExam as any)[`segment${i}_grade`]}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                    <div className="bg-muted p-3 rounded-lg text-center">
                      <p className="text-xs text-muted-foreground">مجموع المراجعة</p>
                      <p className="text-lg font-bold">{latestExam.review_total}</p>
                    </div>
                    <div className="bg-muted p-3 rounded-lg text-center">
                      <p className="text-xs text-muted-foreground">اختبار الحفظ</p>
                      <p className="text-lg font-bold">{latestExam.memorization_grade}</p>
                    </div>
                    <div className="bg-muted p-3 rounded-lg text-center">
                      <p className="text-xs text-muted-foreground">الدرجات الإضافية</p>
                      <p className="text-lg font-bold">{latestExam.extra_points}</p>
                    </div>
                    <div className="bg-primary/10 p-3 rounded-lg text-center">
                      <p className="text-xs text-muted-foreground">المجموع النهائي</p>
                      <p className="text-lg font-bold text-primary">{latestExam.final_grade}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span>المختبر: <strong>{latestExam.examiner_name || "—"}</strong></span>
                    <span>الاعتماد: <strong>{latestExam.supervisor_approval || "—"}</strong></span>
                    <Badge variant={latestExam.passed ? "default" : "destructive"}>
                      {latestExam.passed ? "اجتاز" : "لم يجتز"}
                    </Badge>
                    {latestExam.exam_type === 'trial' && (
                      <Badge variant="outline" className="text-muted-foreground">تجريبي</Badge>
                    )}
                  </div>
                </div>
              )}

              {/* Exam History Table */}
              {exams.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">سجل جميع المحاولات</h4>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>رقم المحاولة</TableHead>
                        <TableHead>النوع</TableHead>
                        <TableHead>التاريخ</TableHead>
                        <TableHead>الدرجة</TableHead>
                        <TableHead>النتيجة</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {exams.map((ex, idx) => (
                        <TableRow
                          key={ex.id}
                          className={idx === 0 ? "border-r-4 border-r-primary" : ""}
                        >
                          <TableCell>{ex.attempt_number}</TableCell>
                          <TableCell>
                            {ex.exam_type === 'trial' ? (
                              <Badge variant="outline" className="text-muted-foreground">تجريبي</Badge>
                            ) : (
                              <Badge variant="secondary">رسمي</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{new Date(ex.created_at).toLocaleDateString('ar-SA')}</TableCell>
                          <TableCell>{ex.final_grade}</TableCell>
                          <TableCell>
                            <Badge variant={ex.passed ? "default" : "destructive"}>
                              {ex.passed ? "ناجح" : "راسب"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {exams.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">لم يتم إجراء أي اختبار بعد</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Daily Progress Dialog */}
      <Dialog open={dpDialogOpen} onOpenChange={setDpDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingDp ? "تعديل سجل يومي" : "إضافة سجل يومي"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSaveDp} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>التاريخ</Label><Input type="date" value={dpForm.progress_date} onChange={e => setDpForm({...dpForm, progress_date: e.target.value})} required /></div>
              <div className="space-y-1"><Label>الحفظ</Label><Input value={dpForm.memorization} onChange={e => setDpForm({...dpForm, memorization: e.target.value})} /></div>
              <div className="space-y-1"><Label>الاستماع (من 3)</Label><Input type="number" min={0} max={3} value={dpForm.listening} onChange={e => setDpForm({...dpForm, listening: Number(e.target.value)})} /></div>
              <div className="space-y-1"><Label>التكرار قبل</Label><Input type="number" min={0} value={dpForm.repetition_before} onChange={e => setDpForm({...dpForm, repetition_before: Number(e.target.value)})} /></div>
              <div className="space-y-1"><Label>التكرار بعد</Label><Input type="number" min={0} value={dpForm.repetition_after} onChange={e => setDpForm({...dpForm, repetition_after: Number(e.target.value)})} /></div>
              <div className="space-y-1"><Label>الدرجة (من 10)</Label><Input type="number" min={0} max={10} value={dpForm.grade} onChange={e => setDpForm({...dpForm, grade: Number(e.target.value)})} /></div>
              <div className="space-y-1"><Label>الربط</Label><Input value={dpForm.linking} onChange={e => setDpForm({...dpForm, linking: e.target.value})} /></div>
              <div className="space-y-1"><Label>عدد الأخطاء</Label><Input type="number" min={0} value={dpForm.mistakes_count} onChange={e => setDpForm({...dpForm, mistakes_count: Number(e.target.value)})} /></div>
              <div className="space-y-1"><Label>المراجعة</Label><Input value={dpForm.review} onChange={e => setDpForm({...dpForm, review: e.target.value})} /></div>
              <div className="space-y-1"><Label>التنفيذ</Label><Input value={dpForm.execution} onChange={e => setDpForm({...dpForm, execution: e.target.value})} /></div>
            </div>
            <Button type="submit" className="w-full">{editingDp ? "حفظ" : "إضافة"}</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Mistakes Dialog */}
      <Dialog open={mistakeDialogOpen} onOpenChange={setMistakeDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingMistake ? "تعديل خطأ" : "إضافة خطأ"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSaveMistake} className="space-y-3">
            <div className="space-y-1"><Label>الخطأ أو اللحن</Label><Input value={mistakeForm.mistake_text} onChange={e => setMistakeForm({...mistakeForm, mistake_text: e.target.value})} required /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>السورة</Label><Input value={mistakeForm.surah} onChange={e => setMistakeForm({...mistakeForm, surah: e.target.value})} /></div>
              <div className="space-y-1"><Label>الآية</Label><Input value={mistakeForm.ayah} onChange={e => setMistakeForm({...mistakeForm, ayah: e.target.value})} /></div>
            </div>
            <Button type="submit" className="w-full">{editingMistake ? "حفظ" : "إضافة"}</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Exam Dialog */}
      <Dialog open={examDialogOpen} onOpenChange={setExamDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {examDialogType === 'trial' ? "اختبار تجريبي" : "اختبار رسمي"} — إضافة محاولة جديدة
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveExam} className="space-y-4">
            {[1,2,3,4,5].map((i) => (
              <div key={i} className="space-y-1">
                <Label className="font-medium">المقطع {i}</Label>
                <div className="grid grid-cols-3 gap-2">
                  <div><Label className="text-xs">أخطاء</Label><Input type="number" min={0} value={(examForm as any)[`segment${i}_errors`]} onChange={e => setExamForm({...examForm, [`segment${i}_errors`]: Number(e.target.value)})} /></div>
                  <div><Label className="text-xs">تنبيهات</Label><Input type="number" min={0} value={(examForm as any)[`segment${i}_warnings`]} onChange={e => setExamForm({...examForm, [`segment${i}_warnings`]: Number(e.target.value)})} /></div>
                  <div><Label className="text-xs">الدرجة</Label><Input type="number" min={0} value={(examForm as any)[`segment${i}_grade`]} onChange={e => setExamForm({...examForm, [`segment${i}_grade`]: Number(e.target.value)})} /></div>
                </div>
              </div>
            ))}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>اختبار الحفظ</Label><Input type="number" min={0} value={examForm.memorization_grade} onChange={e => setExamForm({...examForm, memorization_grade: Number(e.target.value)})} /></div>
              <div className="space-y-1"><Label>الدرجات الإضافية</Label><Input type="number" min={0} value={examForm.extra_points} onChange={e => setExamForm({...examForm, extra_points: Number(e.target.value)})} /></div>
              <div className="space-y-1"><Label>اسم المختبر</Label><Input value={examForm.examiner_name} onChange={e => setExamForm({...examForm, examiner_name: e.target.value})} /></div>
              <div className="space-y-1"><Label>اعتماد الإشراف</Label><Input value={examForm.supervisor_approval} onChange={e => setExamForm({...examForm, supervisor_approval: e.target.value})} /></div>
              <div className="space-y-1"><Label>تاريخ الاجتياز</Label><Input type="date" value={examForm.pass_date} onChange={e => setExamForm({...examForm, pass_date: e.target.value})} /></div>
              <div className="space-y-1"><Label>سبب الرسوب (اختياري)</Label><Input value={examForm.failed_reason} onChange={e => setExamForm({...examForm, failed_reason: e.target.value})} placeholder="في حال عدم الاجتياز" /></div>
            </div>
            <Button type="submit" className="w-full">حفظ الاختبار</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Level Downgrade Alert Dialog */}
      <AlertDialog open={levelDowngradeAlert} onOpenChange={setLevelDowngradeAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              تنبيه — نزول المستوى
            </AlertDialogTitle>
            <AlertDialogDescription>
              تم نقل الطالب تلقائياً إلى المستوى الأدنى بعد رسوبين متتاليين في الاختبار الرسمي. تم إشعار ولي الأمر.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction>حسناً</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Dialogs */}
      <AlertDialog open={!!deleteDpId} onOpenChange={() => setDeleteDpId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>حذف السجل اليومي؟</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>إلغاء</AlertDialogCancel><AlertDialogAction onClick={handleDeleteDp} className="bg-destructive text-destructive-foreground">حذف</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!deleteMistakeId} onOpenChange={() => setDeleteMistakeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>حذف الخطأ؟</AlertDialogTitle></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>إلغاء</AlertDialogCancel><AlertDialogAction onClick={handleDeleteMistake} className="bg-destructive text-destructive-foreground">حذف</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MadarijEnrollment;
