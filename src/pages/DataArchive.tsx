import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Archive, RotateCcw, RefreshCw, Database, CalendarDays } from "lucide-react";
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

const DataArchive = () => {
  const { role } = useRole();
  const isManager = role === "manager";

  const [cutoff, setCutoff] = useState<string>(ACADEMIC_YEAR.start);
  const [label, setLabel] = useState<string>("أرشيف الأعوام السابقة");
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [batches, setBatches] = useState<ArchiveBatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [restoreTarget, setRestoreTarget] = useState<ArchiveBatch | null>(null);

  const totalToArchive = useMemo(
    () => (preview ?? []).reduce((sum, r) => sum + (r.count || 0), 0),
    [preview],
  );

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
    setPreview((data as unknown as PreviewRow[]) ?? []);
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
                الإجمالي: {totalToArchive.toLocaleString("ar-EG")} سجل قبل {formatDateSmart(cutoff)}
              </CardDescription>
            </div>
            <Button
              onClick={() => setConfirmArchive(true)}
              disabled={running || loading || totalToArchive === 0}
            >
              <Archive className="ms-1 h-4 w-4" aria-hidden="true" />
              تحويل إلى الأرشيف
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">نوع البيانات</TableHead>
                  <TableHead className="text-right">عدد السجلات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={2} className="py-6 text-center text-muted-foreground">
                      جارٍ الحساب...
                    </TableCell>
                  </TableRow>
                ) : (preview ?? []).length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={2} className="py-6 text-center text-muted-foreground">
                      لا توجد بيانات قابلة للأرشفة قبل هذا التاريخ.
                    </TableCell>
                  </TableRow>
                ) : (
                  (preview ?? []).map((row) => (
                    <TableRow key={row.table}>
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
                    <TableCell>
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
              سيتم وسم {totalToArchive.toLocaleString("ar-EG")} سجل قبل {formatDateSmart(cutoff)} كمؤرشف.
              لا يتم حذف أي بيانات، ويمكن استرجاع الدفعة كاملة في أي وقت.
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
