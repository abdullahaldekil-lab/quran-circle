import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Upload, FileText, AlertCircle, CheckCircle2, X } from "lucide-react";

interface ParsedRow {
  student_name: string;
  halaqa_name: string;
  status: string;
  halaqa_id: string | null;
  error: string | null;
  row: number;
}

interface ImportResult {
  total: number;
  success: number;
  failed: number;
  errors: string[];
}

interface CsvBulkImportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

const CsvBulkImport = ({ open, onOpenChange, onComplete }: CsvBulkImportProps) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload");

  const reset = () => {
    setParsedRows([]);
    setResult(null);
    setStep("upload");
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".csv")) {
      toast.error("يرجى اختيار ملف CSV فقط");
      return;
    }

    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());

    if (lines.length < 2) {
      toast.error("الملف فارغ أو لا يحتوي على بيانات");
      return;
    }

    // Parse header
    const header = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/"/g, ""));
    const nameIdx = header.findIndex((h) => h === "student_name" || h === "name" || h === "الاسم");
    const halaqaIdx = header.findIndex((h) => h === "halaqa_name" || h === "halaqa" || h === "الحلقة");
    const statusIdx = header.findIndex((h) => h === "status" || h === "الحالة");

    if (nameIdx === -1) {
      toast.error("العمود student_name غير موجود في الملف");
      return;
    }

    // Fetch halaqat for matching
    const { data: halaqat } = await supabase.from("halaqat").select("id, name").eq("active", true);
    const halaqaMap = new Map((halaqat || []).map((h) => [h.name.trim(), h.id]));

    const rows: ParsedRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map((c) => c.trim().replace(/"/g, ""));
      const studentName = cols[nameIdx] || "";
      const halaqaName = halaqaIdx !== -1 ? cols[halaqaIdx] || "" : "";
      const status = statusIdx !== -1 ? cols[statusIdx] || "active" : "active";

      if (!studentName) continue;

      let halaqaId: string | null = null;
      let error: string | null = null;

      if (halaqaName) {
        halaqaId = halaqaMap.get(halaqaName) || null;
        if (!halaqaId) error = `الحلقة "${halaqaName}" غير موجودة`;
      }

      const validStatuses = ["active", "inactive", "graduated", "suspended"];
      if (!validStatuses.includes(status)) {
        error = `الحالة "${status}" غير صالحة`;
      }

      rows.push({ student_name: studentName, halaqa_name: halaqaName, status, halaqa_id: halaqaId, error, row: i + 1 });
    }

    if (rows.length === 0) {
      toast.error("لا توجد بيانات صالحة في الملف");
      return;
    }

    setParsedRows(rows);
    setStep("preview");
  };

  const handleImport = async () => {
    const validRows = parsedRows.filter((r) => !r.error);
    if (validRows.length === 0) {
      toast.error("لا توجد صفوف صالحة للاستيراد");
      return;
    }

    setSaving(true);
    const errors: string[] = [];
    let success = 0;

    const records = validRows.map((r) => ({
      full_name: r.student_name,
      halaqa_id: r.halaqa_id,
      status: r.status as "active" | "inactive" | "graduated" | "suspended",
      current_level: "تمهيدي",
    }));

    const { error, count } = await supabase.from("students").insert(records);

    if (error) {
      errors.push(error.message);
    } else {
      success = validRows.length;
    }

    const failedCount = parsedRows.filter((r) => r.error).length;
    setResult({
      total: parsedRows.length,
      success,
      failed: failedCount + (error ? validRows.length : 0),
      errors: [
        ...parsedRows.filter((r) => r.error).map((r) => `سطر ${r.row}: ${r.error}`),
        ...errors,
      ],
    });
    setStep("done");
    setSaving(false);
    if (success > 0) onComplete();
  };

  const validCount = parsedRows.filter((r) => !r.error).length;
  const errorCount = parsedRows.filter((r) => r.error).length;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            استيراد جماعي من CSV
          </DialogTitle>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center space-y-3">
              <FileText className="w-10 h-10 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">اختر ملف CSV يحتوي على أعمدة:</p>
              <code className="text-xs bg-muted px-2 py-1 rounded block">student_name, halaqa_name, status</code>
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                onChange={handleFile}
                className="hidden"
              />
              <Button onClick={() => fileRef.current?.click()} variant="outline">
                <Upload className="w-4 h-4 ml-2" />
                اختر ملف
              </Button>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>• العمود <strong>student_name</strong> مطلوب</p>
              <p>• العمود <strong>halaqa_name</strong> يجب أن يطابق اسم حلقة موجودة</p>
              <p>• العمود <strong>status</strong> اختياري (القيمة الافتراضية: active)</p>
              <p>• المستوى الافتراضي: تمهيدي</p>
            </div>
          </div>
        )}

        {step === "preview" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="secondary">{parsedRows.length} صف</Badge>
              <Badge className="bg-green-100 text-green-800">{validCount} صالح</Badge>
              {errorCount > 0 && <Badge variant="destructive">{errorCount} خطأ</Badge>}
            </div>

            <div className="border rounded-lg max-h-60 overflow-y-auto divide-y text-sm">
              {parsedRows.map((r, i) => (
                <div key={i} className={`px-3 py-2 flex items-center justify-between gap-2 ${r.error ? "bg-destructive/5" : ""}`}>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium">{r.student_name}</span>
                    {r.halaqa_name && <span className="text-muted-foreground text-xs mr-2">({r.halaqa_name})</span>}
                  </div>
                  {r.error ? (
                    <span className="text-destructive text-xs flex items-center gap-1 shrink-0">
                      <AlertCircle className="w-3 h-3" />
                      {r.error}
                    </span>
                  ) : (
                    <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Button onClick={reset} variant="outline" className="flex-1">
                إعادة
              </Button>
              <Button onClick={handleImport} disabled={saving || validCount === 0} className="flex-1">
                {saving ? "جارٍ الاستيراد..." : `استيراد ${validCount} طالب`}
              </Button>
            </div>
          </div>
        )}

        {step === "done" && result && (
          <div className="space-y-4">
            <div className="text-center space-y-2">
              {result.success > 0 ? (
                <CheckCircle2 className="w-12 h-12 mx-auto text-green-600" />
              ) : (
                <AlertCircle className="w-12 h-12 mx-auto text-destructive" />
              )}
              <h3 className="font-semibold text-lg">نتيجة الاستيراد</h3>
            </div>

            <div className="grid grid-cols-3 gap-3 text-center text-sm">
              <div className="border rounded-lg p-3">
                <p className="text-2xl font-bold">{result.total}</p>
                <p className="text-muted-foreground">إجمالي</p>
              </div>
              <div className="border rounded-lg p-3">
                <p className="text-2xl font-bold text-green-600">{result.success}</p>
                <p className="text-muted-foreground">نجح</p>
              </div>
              <div className="border rounded-lg p-3">
                <p className="text-2xl font-bold text-destructive">{result.failed}</p>
                <p className="text-muted-foreground">فشل</p>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="border rounded-lg p-3 max-h-40 overflow-y-auto">
                <p className="text-sm font-medium mb-2">تفاصيل الأخطاء:</p>
                {result.errors.map((err, i) => (
                  <p key={i} className="text-xs text-destructive">{err}</p>
                ))}
              </div>
            )}

            <Button onClick={handleClose} className="w-full">إغلاق</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default CsvBulkImport;
