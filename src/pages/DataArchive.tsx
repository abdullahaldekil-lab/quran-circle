import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  Archive, RotateCcw, RefreshCw, Database, CalendarDays, Eye, Download,
  AlertTriangle, CheckCircle2, Loader2, ChevronDown, Copy,
} from "lucide-react";
import { toast } from "sonner";
import { ACADEMIC_YEAR } from "@/lib/academicYear";
import { formatDateSmart, formatDateTimeSmart } from "@/lib/hijri";
import { useRole } from "@/hooks/useRole";

interface PreviewRow {
  table: string;
  label: string;
  count: number;
}

interface ArchiveBatch {
  id: string;
  label: string;
  cutoff_date: string;
  academic_year_label: string | null;
  status: string;
  total_records: number;
  stats: Record<string, number> | null;
  created_at: string;
  restored_at: string | null;
}

const TYPE_LABELS: Record<string, string> = {
  attendance: "حضور الطلاب",
  recitation_records: "سجلات التسميع",
  talqeen_sessions: "جلسات التلقين",
  talqeen_session_attendance: "حضور جلسات التلقين",
  madarij_daily_progress: "المتابعة اليومية (مدارج)",
  madarij_hizb_exams: "اختبارات الحزب (مدارج)",
  staff_attendance: "حضور الموظفين",
  excellence_sessions: "جلسات التميز",
  excellence_attendance: "حضور التميز",
  excellence_performance: "أداء التميز",
  narration_sessions: "جلسات السرد",
  narration_results: "نتائج السرد",
  tarbawi_weekly_records: "المتابعة التربوية الأسبوعية",
  tarbawi_events: "الفعاليات التربوية",
  summer_daily_records: "السجلات اليومية الصيفية",
  summer_attendance: "الحضور الصيفي",
  trips: "الرحلات",
};

const PAGE_SIZE = 20;

type StepStatus = "pending" | "running" | "done" | "failed";

interface RunStep {
  table: string;
  label: string;
  expected: number;
  archived: number;
  status: StepStatus;
  error?: string;
}

interface FailureDetail {
  title: string;
  table?: string;
  message: string;
  code?: string;
  details?: string;
  hint?: string;
  at: string;
}

const asPgError = (error: unknown) => {
  const e = (error ?? {}) as { message?: string; code?: string; details?: string; hint?: string };
  return {
    message: e.message || "خطأ غير معروف من قاعدة البيانات",
    code: e.code,
    details: e.details,
    hint: e.hint,
  };
};

const toCsv = (rows: Record<string, unknown>[]) => {
  if (rows.length === 0) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v: unknown) => {
    const t = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  return [cols.join(","), ...rows.map((r) => cols.map((c) => esc(r[c])).join(","))].join("\n");
};

const DataArchive = () => {
  const { role } = useRole();
  const isManager = role === "manager";

  const [cutoff, setCutoff] = useState<string>(ACADEMIC_YEAR.start);
  const [label, setLabel] = useState<string>("أرشيف الأعوام السابقة");
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [batches, setBatches] = useState<ArchiveBatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<ArchiveBatch | null>(null);

  const [viewBatch, setViewBatch] = useState<ArchiveBatch | null>(null);
  const [viewTable, setViewTable] = useState<string>("");
  const [viewRows, setViewRows] = useState<Record<string, unknown>[]>([]);
  const [viewCount, setViewCount] = useState(0);
  const [viewPage, setViewPage] = useState(0);
  const [viewLoading, setViewLoading] = useState(false);

  const batchTypes = useMemo(() => {
    const stats = viewBatch?.stats ?? {};
    return Object.entries(stats)
      .filter(([, n]) => Number(n) > 0)
      .map(([t, n]) => ({ table: t, label: TYPE_LABELS[t] ?? t, count: Number(n) }));
  }, [viewBatch]);

  const openViewer = (batch: ArchiveBatch) => {
    const types = Object.entries(batch.stats ?? {}).filter(([, n]) => Number(n) > 0);
    setViewBatch(batch);
    setViewPage(0);
    setViewRows([]);
    setViewTable(types[0]?.[0] ?? "");
  };

  const loadViewRows = useCallback(async () => {
    if (!viewBatch || !viewTable) return;
    setViewLoading(true);
    const from = viewPage * PAGE_SIZE;
    const { data, count, error } = await (supabase as any)
      .from(viewTable)
      .select("*", { count: "exact" })
      .eq("archived_batch_id", viewBatch.id)
      .order("archived_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    setViewLoading(false);
    if (error) {
      toast.error("تعذّر عرض بيانات الأرشيف", { description: error.message });
      setViewRows([]);
      return;
    }
    setViewRows((data ?? []) as Record<string, unknown>[]);
    setViewCount(count ?? 0);
  }, [viewBatch, viewTable, viewPage]);

  useEffect(() => {
    loadViewRows();
  }, [loadViewRows]);

  const exportViewCsv = async () => {
    if (!viewBatch || !viewTable) return;
    const { data, error } = await (supabase as any)
      .from(viewTable)
      .select("*")
      .eq("archived_batch_id", viewBatch.id)
      .limit(5000);
    if (error) {
      toast.error("تعذّر التصدير", { description: error.message });
      return;
    }
    const csv = toCsv((data ?? []) as Record<string, unknown>[]);
    if (!csv) {
      toast.info("لا توجد بيانات للتصدير");
      return;
    }
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${viewTable}-${viewBatch.label}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const viewColumns = useMemo(
    () => (viewRows[0] ? Object.keys(viewRows[0]).slice(0, 8) : []),
    [viewRows],
  );

  const availableRows = useMemo(
    () => (preview ?? []).filter((r) => (r.count || 0) > 0),
    [preview],
  );

  const totalToArchive = useMemo(
    () =>
      availableRows
        .filter((r) => selected.includes(r.table))
        .reduce((sum, r) => sum + (r.count || 0), 0),
    [availableRows, selected],
  );

  const toggleTable = (table: string) =>
    setSelected((prev) =>
      prev.includes(table) ? prev.filter((t) => t !== table) : [...prev, table],
    );

  const allSelected =
    availableRows.length > 0 && availableRows.every((r) => selected.includes(r.table));

  const toggleAll = () =>
    setSelected(allSelected ? [] : availableRows.map((r) => r.table));

  const loadBatches = useCallback(async () => {
    const { data, error } = await supabase
      .from("archive_batches")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) return;
    setBatches((data ?? []) as unknown as ArchiveBatch[]);
  }, []);

  const loadPreview = useCallback(async () => {
    if (!isManager || !cutoff) return;
    setLoading(true);
    const { data, error } = await supabase.rpc("preview_archive", { _cutoff: cutoff });
    setLoading(false);
    if (error) {
      toast.error("تعذّر حساب المعاينة", { description: error.message });
      return;
    }
    const rows = (data as unknown as PreviewRow[]) ?? [];
    setPreview(rows);
    setSelected((prev) => prev.filter((t) => rows.some((r) => r.table === t && r.count > 0)));
  }, [cutoff, isManager]);

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  const runArchive = async () => {
    setRunning(true);
    const { data, error } = await supabase.rpc("run_archive", {
      _cutoff: cutoff,
      _label: label,
      _year_label: ACADEMIC_YEAR.label,
      _tables: selected,
    });
    setRunning(false);
    setConfirmArchive(false);
    if (error) {
      toast.error("فشلت عملية الأرشفة", { description: error.message });
      return;
    }
    const total = (data as { total?: number } | null)?.total ?? 0;
    toast.success(`تمت الأرشفة بنجاح — ${total} سجل`);
    await Promise.all([loadBatches(), loadPreview()]);
  };

  const restoreBatch = async (batch: ArchiveBatch) => {
    const { data, error } = await supabase.rpc("restore_archive", { _batch_id: batch.id });
    setRestoreTarget(null);
    if (error) {
      toast.error("تعذّر الاسترجاع", { description: error.message });
      return;
    }
    const restored = (data as { restored?: number } | null)?.restored ?? 0;
    toast.success(`تم استرجاع ${restored} سجل من الأرشيف`);
    await Promise.all([loadBatches(), loadPreview()]);
  };

  return (
    <div className="space-y-6" dir="rtl">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Archive className="h-6 w-6 text-primary" aria-hidden="true" />
            أرشفة البيانات
          </h1>
          <p className="text-sm text-muted-foreground">
            تحويل كل ما قبل بداية العام الدراسي الحالي إلى أرشيف، مع إمكانية الاسترجاع.
          </p>
        </div>
        <Button variant="outline" onClick={loadPreview} disabled={loading || !isManager}>
          <RefreshCw className="ms-1 h-4 w-4" aria-hidden="true" />
          تحديث المعاينة
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CalendarDays className="h-5 w-5 text-primary" aria-hidden="true" />
            حد الأرشفة
          </CardTitle>
          <CardDescription>
            العام الدراسي الحالي: {ACADEMIC_YEAR.label} — يبدأ في {formatDateSmart(ACADEMIC_YEAR.start)}.
            كل السجلات قبل هذا التاريخ قابلة للأرشفة.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="cutoff">التاريخ الفاصل</Label>
            <Input
              id="cutoff"
              type="date"
              value={cutoff}
              onChange={(e) => setCutoff(e.target.value)}
              disabled={!isManager}
            />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="label">اسم دفعة الأرشيف</Label>
            <Input
              id="label"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="أرشيف العام 1447 هـ"
              disabled={!isManager}
            />
          </div>
        </CardContent>
      </Card>

      {!isManager ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            تنفيذ الأرشفة والاسترجاع متاح للمدير فقط، ويمكنك الاطلاع على دفعات الأرشيف بالأسفل.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Database className="h-5 w-5 text-primary" aria-hidden="true" />
                السجلات القابلة للأرشفة
              </CardTitle>
              <CardDescription>
                المحدَّد للأرشفة: {totalToArchive.toLocaleString("ar-EG")} سجل من{" "}
                {selected.length.toLocaleString("ar-EG")} نوع بيانات، قبل {formatDateSmart(cutoff)}.
                الأنواع غير المحددة تبقى نشطة كما هي.
              </CardDescription>
            </div>
            <Button
              onClick={() => setConfirmArchive(true)}
              disabled={running || loading || selected.length === 0 || totalToArchive === 0}
            >
              <Archive className="ms-1 h-4 w-4" aria-hidden="true" />
              تحويل إلى الأرشيف
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 text-right">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={toggleAll}
                      aria-label="اختيار كل أنواع البيانات"
                      disabled={availableRows.length === 0}
                    />
                  </TableHead>
                  <TableHead className="text-right">نوع البيانات</TableHead>
                  <TableHead className="text-right">عدد السجلات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="py-6 text-center text-muted-foreground">
                      جارٍ الحساب...
                    </TableCell>
                  </TableRow>
                ) : (preview ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="py-6 text-center text-muted-foreground">
                      لا توجد بيانات قابلة للأرشفة قبل هذا التاريخ.
                    </TableCell>
                  </TableRow>
                ) : (
                  (preview ?? []).map((row) => (
                    <TableRow key={row.table} className={row.count === 0 ? "opacity-60" : undefined}>
                      <TableCell>
                        <Checkbox
                          checked={selected.includes(row.table)}
                          onCheckedChange={() => toggleTable(row.table)}
                          disabled={row.count === 0}
                          aria-label={`أرشفة ${row.label}`}
                        />
                      </TableCell>
                      <TableCell>{row.label}</TableCell>
                      <TableCell>
                        <Badge variant={row.count > 0 ? "default" : "outline"}>
                          {row.count.toLocaleString("ar-EG")}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">دفعات الأرشيف</CardTitle>
          <CardDescription>سجل عمليات الأرشفة السابقة وإمكانية استرجاعها.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">الدفعة</TableHead>
                <TableHead className="text-right">التاريخ الفاصل</TableHead>
                <TableHead className="text-right">عدد السجلات</TableHead>
                <TableHead className="text-right">الحالة</TableHead>
                <TableHead className="text-right">تاريخ التنفيذ</TableHead>
                <TableHead className="text-right">إجراء</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {batches.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                    لا توجد عمليات أرشفة بعد.
                  </TableCell>
                </TableRow>
              ) : (
                batches.map((b) => (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.label}</TableCell>
                    <TableCell>{formatDateSmart(b.cutoff_date)}</TableCell>
                    <TableCell>{b.total_records.toLocaleString("ar-EG")}</TableCell>
                    <TableCell>
                      <Badge variant={b.status === "restored" ? "outline" : "secondary"}>
                        {b.status === "restored" ? "مُسترجعة" : "مؤرشفة"}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDateTimeSmart(b.created_at)}</TableCell>
                    <TableCell className="flex flex-wrap gap-2">
                      <Button variant="secondary" size="sm" onClick={() => openViewer(b)}>
                        <Eye className="ms-1 h-4 w-4" aria-hidden="true" />
                        عرض البيانات
                      </Button>
                      {isManager && b.status !== "restored" && (
                        <Button variant="outline" size="sm" onClick={() => setRestoreTarget(b)}>
                          <RotateCcw className="ms-1 h-4 w-4" aria-hidden="true" />
                          استرجاع
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={confirmArchive} onOpenChange={setConfirmArchive}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الأرشفة</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم وسم {totalToArchive.toLocaleString("ar-EG")} سجل قبل {formatDateSmart(cutoff)} كمؤرشف،
              من الأنواع المحددة فقط:{" "}
              {availableRows
                .filter((r) => selected.includes(r.table))
                .map((r) => r.label)
                .join("، ")}
              . بقية الأنواع لن تتأثر، ولا يتم حذف أي بيانات، ويمكن استرجاع الدفعة كاملة في أي وقت.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={runArchive} disabled={running}>
              تنفيذ الأرشفة
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!viewBatch} onOpenChange={(o) => !o && setViewBatch(null)}>
        <DialogContent dir="rtl" className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>بيانات الأرشيف — {viewBatch?.label}</DialogTitle>
            <DialogDescription>
              استعراض السجلات المؤرشفة قبل {viewBatch ? formatDateSmart(viewBatch.cutoff_date) : ""} حسب نوع البيانات،
              مع إمكانية تصديرها.
            </DialogDescription>
          </DialogHeader>

          {batchTypes.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground">لا توجد سجلات في هذه الدفعة.</p>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-56 space-y-2">
                  <Label>نوع البيانات</Label>
                  <Select
                    value={viewTable}
                    onValueChange={(v) => {
                      setViewTable(v);
                      setViewPage(0);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="اختر نوع البيانات" />
                    </SelectTrigger>
                    <SelectContent>
                      {batchTypes.map((t) => (
                        <SelectItem key={t.table} value={t.table}>
                          {t.label} ({t.count.toLocaleString("ar-EG")})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button variant="outline" onClick={exportViewCsv}>
                  <Download className="ms-1 h-4 w-4" aria-hidden="true" />
                  تصدير CSV
                </Button>
                <span className="text-sm text-muted-foreground">
                  الإجمالي: {viewCount.toLocaleString("ar-EG")} سجل
                </span>
              </div>

              <div className="max-h-[50vh] overflow-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {viewColumns.map((c) => (
                        <TableHead key={c} className="whitespace-nowrap text-right">{c}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {viewLoading ? (
                      <TableRow>
                        <TableCell colSpan={Math.max(viewColumns.length, 1)} className="py-6 text-center text-muted-foreground">
                          جارٍ التحميل...
                        </TableCell>
                      </TableRow>
                    ) : viewRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={Math.max(viewColumns.length, 1)} className="py-6 text-center text-muted-foreground">
                          لا توجد سجلات لعرضها.
                        </TableCell>
                      </TableRow>
                    ) : (
                      viewRows.map((row, i) => (
                        <TableRow key={String(row.id ?? i)}>
                          {viewColumns.map((c) => (
                            <TableCell key={c} className="max-w-48 truncate whitespace-nowrap">
                              {row[c] === null || row[c] === undefined
                                ? "—"
                                : typeof row[c] === "object"
                                  ? JSON.stringify(row[c])
                                  : String(row[c])}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={viewPage === 0 || viewLoading}
                  onClick={() => setViewPage((p) => Math.max(0, p - 1))}
                >
                  السابق
                </Button>
                <span className="text-sm text-muted-foreground">
                  صفحة {(viewPage + 1).toLocaleString("ar-EG")} من{" "}
                  {Math.max(1, Math.ceil(viewCount / PAGE_SIZE)).toLocaleString("ar-EG")}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={viewLoading || (viewPage + 1) * PAGE_SIZE >= viewCount}
                  onClick={() => setViewPage((p) => p + 1)}
                >
                  التالي
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!restoreTarget} onOpenChange={(o) => !o && setRestoreTarget(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>استرجاع دفعة الأرشيف</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم إلغاء وسم الأرشفة عن سجلات «{restoreTarget?.label}» وإعادتها للبيانات النشطة.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={() => restoreTarget && restoreBatch(restoreTarget)}>
              استرجاع
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default DataArchive;
