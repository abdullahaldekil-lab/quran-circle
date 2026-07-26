import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileSpreadsheet, CalendarCheck, History } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx-js-style";
import { filterTahfeezOnly } from "@/lib/halaqaType";
import { buildNazemRow } from "@/lib/nazem-export";
import { formatDateTimeSmart } from "@/lib/hijri";

const NazemExport = () => {
  const { user } = useAuth();
  const today = new Date().toISOString().split("T")[0];
  const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];

  const [halaqat, setHalaqat] = useState<any[]>([]);
  const [halaqaId, setHalaqaId] = useState<string>("all");
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState<any[]>([]);

  useEffect(() => {
    supabase.from("halaqat").select("id, name, teacher_id, talqeen_curriculum_id").eq("active", true).then(({ data }) => {
      setHalaqat(filterTahfeezOnly((data as any[]) || []));
    });
  }, []);

  const loadLog = useCallback(async () => {
    const { data } = await (supabase as any)
      .from("nazem_export_log")
      .select("id, exported_at, date_from, date_to, halaqa_id, rows_count")
      .order("exported_at", { ascending: false })
      .limit(5);
    setLog((data as any[]) || []);
  }, []);

  useEffect(() => { loadLog(); }, [loadLog]);

  const runExport = async (rangeFrom: string, rangeTo: string) => {
    setLoading(true);
    try {
      let query = supabase
        .from("recitation_records")
        .select("record_date, memorized_from, memorized_to, total_score, mistakes_breakdown, notes, student_id, halaqa_id")
        .gte("record_date", rangeFrom)
        .lte("record_date", rangeTo)
        .not("memorized_to", "is", null)
        .order("record_date", { ascending: true });

      if (halaqaId !== "all") query = query.eq("halaqa_id", halaqaId);

      const { data: records, error } = await query;
      if (error) throw error;
      if (!records || records.length === 0) {
        toast.error("لا توجد سجلات في الفترة المحددة");
        return;
      }

      const studentIds = [...new Set(records.map((r: any) => r.student_id))];
      const halaqaIds = [...new Set(records.map((r: any) => r.halaqa_id).filter(Boolean))];

      const [studentsRes, halaqatRes] = await Promise.all([
        supabase.from("students").select("id, full_name, national_id, student_code").in("id", studentIds),
        supabase.from("halaqat").select("id, name, teacher_id").in("id", halaqaIds),
      ]);

      const teacherIds = [...new Set((halaqatRes.data || []).map((h: any) => h.teacher_id).filter(Boolean))];
      const { data: teachers } = await supabase.from("profiles").select("id, full_name").in("id", teacherIds);

      const studentMap = new Map((studentsRes.data || []).map((s: any) => [s.id, s]));
      const halaqaMap = new Map((halaqatRes.data || []).map((h: any) => [h.id, h]));
      const teacherMap = new Map((teachers || []).map((t: any) => [t.id, t]));

      const rows = records.map((r: any) =>
        buildNazemRow(r, studentMap as any, halaqaMap as any, teacherMap as any),
      );

      const ws = XLSX.utils.json_to_sheet(rows);
      ws["!cols"] = [
        { wch: 12 }, { wch: 22 }, { wch: 14 }, { wch: 12 }, { wch: 18 },
        { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 8 }, { wch: 8 },
        { wch: 8 }, { wch: 8 }, { wch: 30 },
      ];
      ws["!views"] = [{ RTL: true } as any];

      // Header styling
      const range = XLSX.utils.decode_range(ws["!ref"]!);
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r: 0, c });
        if (ws[addr]) {
          ws[addr].s = {
            font: { bold: true, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "1F5D3A" } },
            alignment: { horizontal: "center", vertical: "center" },
          };
        }
      }

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "تسميع - ناظم");
      const filename = `nazem-export-${rangeFrom}_to_${rangeTo}.xlsx`;
      XLSX.writeFile(wb, filename);

      // Record the export so the same period is not sent twice by mistake.
      await (supabase as any).from("nazem_export_log").insert({
        exported_by: user?.id ?? null,
        date_from: rangeFrom,
        date_to: rangeTo,
        halaqa_id: halaqaId === "all" ? null : halaqaId,
        rows_count: rows.length,
      });
      loadLog();

      toast.success(`تم التصدير: ${rows.length} سجل`);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "فشل التصدير");
    } finally {
      setLoading(false);
    }
  };

  const halaqaName = (id: string | null) =>
    id ? (halaqat.find((h) => h.id === id)?.name ?? "حلقة محذوفة") : "جميع الحلقات";

  return (
    <div className="container mx-auto p-4 max-w-3xl space-y-4" dir="rtl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            تصدير التسميع لمنصة ناظم
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            يتم تصدير سجلات الحفظ الجديد في الفترة المحددة كملف Excel جاهز للرفع على منصة ناظم.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>من تاريخ</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>إلى تاريخ</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>الحلقة</Label>
              <Select value={halaqaId} onValueChange={setHalaqaId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الحلقات</SelectItem>
                  {halaqat.map((h) => (
                    <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Button onClick={() => runExport(from, to)} disabled={loading} className="w-full">
              <Download className="w-4 h-4 ml-2" />
              {loading ? "جارٍ التصدير..." : "تصدير الفترة المحددة"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => runExport(today, today)}
              disabled={loading}
              className="w-full"
            >
              <CalendarCheck className="w-4 h-4 ml-2" />
              تصدير نتائج اليوم
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="w-4 h-4 text-muted-foreground" />
            آخر عمليات التصدير
          </CardTitle>
        </CardHeader>
        <CardContent>
          {log.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-3">لا توجد عمليات تصدير سابقة.</p>
          ) : (
            <div className="space-y-2">
              {log.map((l) => (
                <div key={l.id} className="flex items-center justify-between gap-2 text-sm border rounded-lg px-3 py-2">
                  <div>
                    <p className="font-medium">{l.date_from} → {l.date_to}</p>
                    <p className="text-xs text-muted-foreground">{halaqaName(l.halaqa_id)}</p>
                  </div>
                  <div className="text-left">
                    <p className="font-bold">{l.rows_count} سجل</p>
                    <p className="text-xs text-muted-foreground">{formatDateTimeSmart(l.exported_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default NazemExport;
