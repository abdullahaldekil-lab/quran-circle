import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { AlertTriangle, ArrowLeft, Eraser, Eye, Loader2, RefreshCw } from "lucide-react";

export interface PurgePreviewRow {
  table: string;
  label: string;
  count: number;
}

export const fetchPurgePreview = async (studentId: string | null): Promise<PurgePreviewRow[]> => {
  const { data, error } = await supabase.rpc("preview_student_purge" as any, {
    _student_id: studentId,
  });
  if (error) throw error;
  return ((data as any) || []) as PurgePreviewRow[];
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = جميع الطلاب */
  studentId: string | null;
  studentName?: string;
  onDone?: () => void;
}

type Step = "preview" | "confirm";

const StudentPurgeDialog = ({ open, onOpenChange, studentId, studentName, onDone }: Props) => {
  const isBulk = studentId === null;
  const [step, setStep] = useState<Step>("preview");
  const [rows, setRows] = useState<PurgePreviewRow[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  const expected = isBulk ? "تصفير" : (studentName || "").trim();

  const loadPreview = async () => {
    setLoading(true);
    setErrorDetail(null);
    try {
      const data = await fetchPurgePreview(studentId);
      setRows(data);
      setSelected(data.filter((r) => r.count > 0).map((r) => r.table));
    } catch (e: any) {
      setRows([]);
      setErrorDetail(e.message || String(e));
      toast.error("تعذر جلب معاينة السجلات");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setStep("preview");
    setConfirmText("");
    loadPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, studentId]);

  const withData = useMemo(() => rows.filter((r) => r.count > 0), [rows]);
  const selectedRows = useMemo(
    () => rows.filter((r) => selected.includes(r.table) && r.count > 0),
    [rows, selected]
  );
  const totalSelected = selectedRows.reduce((s, r) => s + Number(r.count || 0), 0);
  const allSelected = withData.length > 0 && withData.every((r) => selected.includes(r.table));

  const toggle = (tbl: string) =>
    setSelected((prev) => (prev.includes(tbl) ? prev.filter((t) => t !== tbl) : [...prev, tbl]));

  const toggleAll = () =>
    setSelected(allSelected ? [] : withData.map((r) => r.table));

  const close = (o: boolean) => {
    if (running) return;
    if (!o) setStep("preview");
    onOpenChange(o);
  };

  const run = async () => {
    if (confirmText.trim() !== expected) {
      toast.error(isBulk ? "اكتب كلمة «تصفير» للتأكيد" : "اكتب اسم الطالب كما هو للتأكيد");
      return;
    }
    setRunning(true);
    setErrorDetail(null);
    try {
      const { data, error } = await supabase.rpc("purge_student_records" as any, {
        _student_id: studentId,
        _tables: selected,
      });
      if (error) throw error;
      const total = (data as any)?.total ?? 0;
      toast.success(`تم حذف ${total} سجلاً`);
      onOpenChange(false);
      setStep("preview");
      onDone?.();
    } catch (e: any) {
      setErrorDetail(
        [
          e.message && `الرسالة: ${e.message}`,
          e.code && `الرمز: ${e.code}`,
          e.details && `التفاصيل: ${e.details}`,
          e.hint && `الاقتراح: ${e.hint}`,
        ]
          .filter(Boolean)
          .join("\n")
      );
      toast.error("فشل التصفير — راجع التفاصيل");
    } finally {
      setRunning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-2xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eraser className="w-5 h-5" />
            {isBulk ? "تصفير سجلات جميع الطلاب" : `تصفير سجلات: ${studentName}`}
          </DialogTitle>
          <DialogDescription>
            {step === "preview"
              ? "الخطوة 1 من 2: معاينة تفصيلية للسجلات المتوقع حذفها لكل نوع/جدول."
              : "الخطوة 2 من 2: التأكيد النهائي قبل التنفيذ — لا يمكن الاسترجاع بعد الحذف."}
          </DialogDescription>
        </DialogHeader>

        <Alert variant="destructive">
          <AlertTriangle className="w-4 h-4" />
          <AlertTitle>عملية غير قابلة للاسترجاع</AlertTitle>
          <AlertDescription>
            يتم حذف السجلات المختارة نهائيًا مع الإبقاء على بيانات الطالب الأساسية. يُنصح بتنفيذ الأرشفة أولًا من صفحة «أرشيف البيانات».
          </AlertDescription>
        </Alert>

        {step === "preview" && (
          <>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : withData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">لا توجد سجلات قابلة للتصفير.</p>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="تحديد الكل" />
                    تحديد الكل
                  </label>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">المحدد: {totalSelected} سجل</span>
                    <Button variant="ghost" size="sm" onClick={loadPreview} aria-label="تحديث المعاينة">
                      <RefreshCw className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                <ScrollArea className="h-64 rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10"></TableHead>
                        <TableHead>نوع البيانات</TableHead>
                        <TableHead>الجدول</TableHead>
                        <TableHead className="text-left">عدد السجلات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {withData.map((r) => (
                        <TableRow key={r.table} className="cursor-pointer" onClick={() => toggle(r.table)}>
                          <TableCell>
                            <Checkbox
                              checked={selected.includes(r.table)}
                              onCheckedChange={() => toggle(r.table)}
                              aria-label={r.label}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{r.label}</TableCell>
                          <TableCell className="text-muted-foreground text-xs" dir="ltr">{r.table}</TableCell>
                          <TableCell className="text-left font-semibold">{r.count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </>
            )}

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => close(false)}>
                إلغاء
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => setStep("confirm")}
                disabled={loading || selectedRows.length === 0}
              >
                <Eye className="w-4 h-4 ml-1" />
                مراجعة التأكيد النهائي ({totalSelected} سجل)
              </Button>
            </div>
          </>
        )}

        {step === "confirm" && (
          <>
            <ScrollArea className="h-56 rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>نوع البيانات</TableHead>
                    <TableHead>الجدول</TableHead>
                    <TableHead className="text-left">سيتم حذف</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedRows.map((r) => (
                    <TableRow key={r.table}>
                      <TableCell className="font-medium">{r.label}</TableCell>
                      <TableCell className="text-muted-foreground text-xs" dir="ltr">{r.table}</TableCell>
                      <TableCell className="text-left font-semibold text-destructive">{r.count}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50">
                    <TableCell colSpan={2} className="font-bold">الإجمالي</TableCell>
                    <TableCell className="text-left font-bold text-destructive">{totalSelected}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </ScrollArea>

            <div className="space-y-2">
              <Label>
                {isBulk ? "تأكيد نهائي: اكتب كلمة «تصفير»" : "تأكيد نهائي: اكتب اسم الطالب"}
              </Label>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={expected}
                autoFocus
              />
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep("preview")} disabled={running}>
                <ArrowLeft className="w-4 h-4 ml-1" />
                رجوع للمعاينة
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => close(false)} disabled={running}>
                إلغاء
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={run}
                disabled={running || confirmText.trim() !== expected}
              >
                {running && <Loader2 className="w-4 h-4 ml-1 animate-spin" />}
                تنفيذ التصفير نهائيًا ({totalSelected})
              </Button>
            </div>
          </>
        )}

        {errorDetail && (
          <Alert variant="destructive">
            <AlertTriangle className="w-4 h-4" />
            <AlertTitle>تفاصيل الخطأ</AlertTitle>
            <AlertDescription>
              <pre className="whitespace-pre-wrap text-xs">{errorDetail}</pre>
            </AlertDescription>
          </Alert>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default StudentPurgeDialog;
