import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ClipboardCheck, Plus, Pencil, Trash2, Award, Printer } from "lucide-react";
import { toast } from "sonner";
import { useRole } from "@/hooks/useRole";
import { formatDateSmart } from "@/lib/hijri";
import TalqeenLevelCertificate from "./TalqeenLevelCertificate";

type TestType = "internal_1" | "internal_2" | "promotion";

interface TalqeenTest {
  id: string;
  student_id: string;
  curriculum_id: string | null;
  test_type: TestType;
  test_date: string;
  score: number | null;
  max_score: number | null;
  status: "pending" | "passed" | "failed";
  notes: string | null;
  attendance_score: number | null;
  attendance_max: number | null;
  homework_score: number | null;
  homework_max: number | null;
  created_at: string;
}

const TEST_LABELS: Record<TestType, string> = {
  internal_1: "اختبار داخلي أول",
  internal_2: "اختبار داخلي ثاني",
  promotion: "اختبار الانتقال للمستوى الأعلى",
};

const STATUS_LABELS = {
  pending: { label: "قيد الانتظار", variant: "secondary" as const },
  passed: { label: "ناجح", variant: "default" as const },
  failed: { label: "راسب", variant: "destructive" as const },
};

interface Props {
  studentId: string;
  studentName?: string;
  curriculumId?: string | null;
  curriculumName?: string;
  halaqaName?: string;
}

export default function TalqeenStudentTests({ studentId, studentName = "الطالب", curriculumId, curriculumName = "", halaqaName }: Props) {
  const { isManager, isTalqeenSupervisor, isTeacher } = useRole();
  const canEdit = isManager || isTalqeenSupervisor || isTeacher;
  const canDelete = isManager || isTalqeenSupervisor;

  const [tests, setTests] = useState<TalqeenTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [certOpen, setCertOpen] = useState(false);
  const certRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState({
    test_type: "internal_1" as TestType,
    test_date: new Date().toISOString().slice(0, 10),
    score: "",
    max_score: "100",
    status: "pending" as "pending" | "passed" | "failed",
    notes: "",
    attendance_score: "",
    attendance_max: "100",
    homework_score: "",
    homework_max: "100",
  });

  const fetchTests = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("talqeen_student_tests")
      .select("*")
      .eq("student_id", studentId)
      .order("test_type");
    if (error) {
      toast.error("تعذر تحميل اختبارات التلقين");
    } else {
      setTests((data || []) as TalqeenTest[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchTests();
  }, [studentId]);

  const promotionTest = tests.find((t) => t.test_type === "promotion" && t.status === "passed");

  const resetForm = () => {
    setForm({
      test_type: "internal_1",
      test_date: new Date().toISOString().slice(0, 10),
      score: "",
      max_score: "100",
      status: "pending",
      notes: "",
      attendance_score: "",
      attendance_max: "100",
      homework_score: "",
      homework_max: "100",
    });
    setEditId(null);
  };

  const openAdd = () => {
    resetForm();
    setOpen(true);
  };

  const openEdit = (t: TalqeenTest) => {
    setEditId(t.id);
    setForm({
      test_type: t.test_type,
      test_date: t.test_date,
      score: t.score?.toString() ?? "",
      max_score: t.max_score?.toString() ?? "100",
      status: t.status,
      notes: t.notes ?? "",
      attendance_score: t.attendance_score?.toString() ?? "",
      attendance_max: t.attendance_max?.toString() ?? "100",
      homework_score: t.homework_score?.toString() ?? "",
      homework_max: t.homework_max?.toString() ?? "100",
    });
    setOpen(true);
  };

  const handleSave = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    const isPromotion = form.test_type === "promotion";
    const payload: any = {
      student_id: studentId,
      curriculum_id: curriculumId || null,
      test_type: form.test_type,
      test_date: form.test_date,
      score: form.score ? Number(form.score) : null,
      max_score: form.max_score ? Number(form.max_score) : 100,
      status: form.status,
      notes: form.notes || null,
      created_by: user?.id,
      attendance_score: isPromotion && form.attendance_score ? Number(form.attendance_score) : null,
      attendance_max: isPromotion ? Number(form.attendance_max) || 100 : null,
      homework_score: isPromotion && form.homework_score ? Number(form.homework_score) : null,
      homework_max: isPromotion ? Number(form.homework_max) || 100 : null,
    };

    let error;
    if (editId) {
      ({ error } = await supabase.from("talqeen_student_tests").update(payload).eq("id", editId));
    } else {
      ({ error } = await supabase.from("talqeen_student_tests").insert(payload));
    }

    if (error) {
      toast.error(error.message.includes("duplicate") ? "هذا النوع من الاختبار مسجل بالفعل لهذا المنهج" : "تعذر الحفظ");
      return;
    }
    toast.success(editId ? "تم التحديث" : "تمت الإضافة");
    setOpen(false);
    resetForm();
    fetchTests();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("حذف الاختبار؟")) return;
    const { error } = await supabase.from("talqeen_student_tests").delete().eq("id", id);
    if (error) {
      toast.error("تعذر الحذف");
      return;
    }
    toast.success("تم الحذف");
    fetchTests();
  };

  const handlePrintCertificate = () => {
    if (!certRef.current) return;
    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) return;
    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl">
        <head>
          <title>شهادة نهاية المستوى - ${studentName}</title>
          <style>
            @media print { @page { size: A4; margin: 10mm; } }
            body { margin: 0; padding: 20px; background: #fff; }
          </style>
        </head>
        <body>${certRef.current.innerHTML}</body>
      </html>
    `);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 500);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5 text-primary" />
          اختبارات التلقين
        </CardTitle>
        <div className="flex gap-2">
          {promotionTest && (
            <Button size="sm" variant="outline" onClick={() => setCertOpen(true)} className="border-green-600 text-green-700 hover:bg-green-50">
              <Award className="w-4 h-4 ml-1" /> شهادة نهاية المستوى
            </Button>
          )}
          {canEdit && (
            <Button size="sm" onClick={openAdd}>
              <Plus className="w-4 h-4 ml-1" /> إضافة اختبار
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground text-center py-4">جاري التحميل...</p>
        ) : tests.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            لا توجد اختبارات مسجلة بعد. (اختباران داخليان + اختبار الانتقال للمستوى الأعلى)
          </p>
        ) : (
          <div className="space-y-2">
            {(["internal_1", "internal_2", "promotion"] as TestType[]).map((tt) => {
              const t = tests.find((x) => x.test_type === tt);
              return (
                <div key={tt} className="flex items-center justify-between border rounded-md p-3">
                  <div className="flex-1">
                    <p className="text-sm font-medium">{TEST_LABELS[tt]}</p>
                    {t ? (
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                        <span>{formatDateSmart(t.test_date)}</span>
                        {t.score !== null && (
                          <span className="font-bold text-foreground">
                            {t.score} / {t.max_score}
                          </span>
                        )}
                        <Badge variant={STATUS_LABELS[t.status].variant}>{STATUS_LABELS[t.status].label}</Badge>
                        {tt === "promotion" && t.attendance_score !== null && (
                          <span className="text-cyan-700">حضور: {t.attendance_score}/{t.attendance_max}</span>
                        )}
                        {tt === "promotion" && t.homework_score !== null && (
                          <span className="text-purple-700">واجب: {t.homework_score}/{t.homework_max}</span>
                        )}
                        {t.notes && <span>— {t.notes}</span>}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-1">لم يُسجَّل بعد</p>
                    )}
                  </div>
                  {t && canEdit && (
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => openEdit(t)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      {canDelete && (
                        <Button size="icon" variant="ghost" onClick={() => handleDelete(t.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl" className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "تعديل اختبار" : "إضافة اختبار تلقين"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>نوع الاختبار</Label>
              <Select value={form.test_type} onValueChange={(v) => setForm({ ...form, test_type: v as TestType })} disabled={!!editId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal_1">{TEST_LABELS.internal_1}</SelectItem>
                  <SelectItem value="internal_2">{TEST_LABELS.internal_2}</SelectItem>
                  <SelectItem value="promotion">{TEST_LABELS.promotion}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>تاريخ الاختبار</Label>
                <Input type="date" value={form.test_date} onChange={(e) => setForm({ ...form, test_date: e.target.value })} />
              </div>
              <div>
                <Label>الحالة</Label>
                <Select value={form.status} onValueChange={(v: any) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">قيد الانتظار</SelectItem>
                    <SelectItem value="passed">ناجح</SelectItem>
                    <SelectItem value="failed">راسب</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>درجة الاختبار</Label>
                <Input type="number" value={form.score} onChange={(e) => setForm({ ...form, score: e.target.value })} placeholder="مثال: 85" />
              </div>
              <div>
                <Label>الدرجة العظمى</Label>
                <Input type="number" value={form.max_score} onChange={(e) => setForm({ ...form, max_score: e.target.value })} />
              </div>
            </div>

            {form.test_type === "promotion" && (
              <div className="border rounded-md p-3 bg-green-50/50 space-y-3">
                <p className="text-xs font-medium text-green-800">درجات إضافية تُعرض على شهادة نهاية المستوى</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">درجة الحضور</Label>
                    <Input type="number" value={form.attendance_score} onChange={(e) => setForm({ ...form, attendance_score: e.target.value })} placeholder="مثال: 95" />
                  </div>
                  <div>
                    <Label className="text-xs">حضور / من</Label>
                    <Input type="number" value={form.attendance_max} onChange={(e) => setForm({ ...form, attendance_max: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">درجة الواجب</Label>
                    <Input type="number" value={form.homework_score} onChange={(e) => setForm({ ...form, homework_score: e.target.value })} placeholder="مثال: 90" />
                  </div>
                  <div>
                    <Label className="text-xs">واجب / من</Label>
                    <Input type="number" value={form.homework_max} onChange={(e) => setForm({ ...form, homework_max: e.target.value })} />
                  </div>
                </div>
              </div>
            )}

            <div>
              <Label>ملاحظات</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button onClick={handleSave}>{editId ? "تحديث" : "حفظ"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Certificate Dialog */}
      <Dialog open={certOpen} onOpenChange={setCertOpen}>
        <DialogContent dir="rtl" className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span>شهادة نهاية المستوى</span>
              <Button size="sm" onClick={handlePrintCertificate}>
                <Printer className="w-4 h-4 ml-1" /> طباعة
              </Button>
            </DialogTitle>
          </DialogHeader>
          {promotionTest && (
            <div ref={certRef}>
              <TalqeenLevelCertificate
                studentName={studentName}
                curriculumName={curriculumName || "—"}
                halaqaName={halaqaName}
                promotionScore={promotionTest.score ?? 0}
                promotionMax={promotionTest.max_score ?? 100}
                attendanceScore={promotionTest.attendance_score}
                attendanceMax={promotionTest.attendance_max}
                homeworkScore={promotionTest.homework_score}
                homeworkMax={promotionTest.homework_max}
                testDate={promotionTest.test_date}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
