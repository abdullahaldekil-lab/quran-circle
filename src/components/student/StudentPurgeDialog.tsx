import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { AlertTriangle, Eraser, Loader2 } from "lucide-react";

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

const StudentPurgeDialog = ({ open, onOpenChange, studentId, studentName, onDone }: Props) => {
  const isBulk = studentId === null;
  const [rows, setRows] = useState<PurgePreviewRow[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  const expected = isBulk ? "تصفير" : (studentName || "").trim();

  useEffect(() => {
    if (!open) return;
    setConfirmText("");
    setErrorDetail(null);
    setLoading(true);
    fetchPurgePreview(studentId)
      .then((data) => {
        setRows(data);
        setSelected(data.filter((r) => r.count > 0).map((r) => r.table));
      })
      .catch((e: any) => {
        setRows([]);
        setErrorDetail(e.message || String(e));
        toast.error("تعذر جلب معاينة السجلات");
      })
      .finally(() => setLoading(false));
  }, [open, studentId]);

  const withData = rows.filter((r) => r.count > 0);
  const totalSelected = rows
    .filter((r) => selected.includes(r.table))
    .reduce((s, r) => s + Number(r.count || 0), 0);
  const allSelected = withData.length > 0 && withData.every((r) => selected.includes(r.table));

  const toggle = (tbl: string) =>
    setSelected((prev) => (prev.includes(tbl) ? prev.filter((t) => t !== tbl) : [...prev, tbl]));

  const toggleAll = () =>
    setSelected(allSelected ? [] : withData.map((r) => r.table));

  const run = async () => {
    if (selected.length === 0) {
      toast.error("اختر نوع بيانات واحدًا على الأقل");
      return;
    }
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
    <Dialog open={open} onOpenChange={(o) => !running && onOpenChange(o)}>
      <DialogContent className="max-w-2xl" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eraser className="w-5 h-5" />
            {isBulk ? "تصفير سجلات جميع الطلاب" : `تصفير سجلات: ${studentName}`}
          </DialogTitle>
          <DialogDescription>
            يتم حذف السجلات المختارة نهائيًا مع الإبقاء على بيانات الطالب الأساسية.
          </DialogDescription>
        </DialogHeader>

        <Alert variant="destructive">
          <AlertTriangle className="w-4 h-4" />
          <AlertTitle>عملية غير قابلة للاسترجاع</AlertTitle>
          <AlertDescription>
            يُنصح بتنفيذ الأرشفة أولًا من صفحة «أرشيف البيانات» قبل التصفير.
          </AlertDescription>
        </Alert>

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
              <span className="text-sm text-muted-foreground">
                المحدد: {totalSelected} سجل
              </span>
            </div>
            <ScrollArea className="h-64 rounded-md border p-3">
              <div className="space-y-2">
                {withData.map((r) => (
                  <label
                    key={r.table}
                    className="flex items-center justify-between gap-3 text-sm cursor-pointer rounded px-2 py-1.5 hover:bg-muted/50"
                  >
                    <span className="flex items-center gap-2">
                      <Checkbox
                        checked={selected.includes(r.table)}
                        onCheckedChange={() => toggle(r.table)}
                        aria-label={r.label}
                      />
                      {r.label}
                    </span>
                    <span className="text-muted-foreground">{r.count}</span>
                  </label>
                ))}
              </div>
            </ScrollArea>

            <div className="space-y-2">
              <Label>
                {isBulk ? "اكتب كلمة «تصفير» للتأكيد" : "اكتب اسم الطالب للتأكيد"}
              </Label>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder={expected}
              />
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

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={running}>
            إلغاء
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            onClick={run}
            disabled={running || loading || withData.length === 0 || confirmText.trim() !== expected}
          >
            {running && <Loader2 className="w-4 h-4 ml-1 animate-spin" />}
            تنفيذ التصفير
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default StudentPurgeDialog;
