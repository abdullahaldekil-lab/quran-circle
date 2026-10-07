import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

const HW_SCORE: Record<string, number> = { submitted: 1, partial: 0.5, not_submitted: 0 };
const ATT_SCORE: Record<string, number> = { present: 1, late: 0.75, late_excused: 0.75, excused: 0.5, absent: 0 };

/** Start of the current study week (Sunday) as YYYY-MM-DD. */
const weekStart = () => {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().split("T")[0];
};

type Agg = { att: number; attN: number; hw: number; hwN: number };
const pct = (v: number, n: number) => (n ? Math.round((v / n) * 100) : 0);

export const TalqeenHalaqaResults = ({ halaqa, students, open, onOpenChange }: {
  halaqa: any; students: { id: string; full_name: string }[]; open: boolean; onOpenChange: (o: boolean) => void;
}) => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !halaqa) return;
    (async () => {
      setLoading(true);
      const { data: sessions } = await supabase.from("talqeen_sessions").select("id, session_date").eq("halaqa_id", halaqa.id);
      const ids = (sessions || []).map((s: any) => s.id);
      const dateById = new Map((sessions || []).map((s: any) => [s.id, s.session_date]));
      let att: any[] = [];
      for (let i = 0; i < ids.length; i += 200) {
        const { data } = await (supabase as any).from("talqeen_session_attendance")
          .select("session_id, student_id, status, homework_status").in("session_id", ids.slice(i, i + 200));
        att = att.concat(data || []);
      }
      setRows(att.map((a) => ({ ...a, date: dateById.get(a.session_id) })));
      setLoading(false);
    })();
  }, [open, halaqa]);

  const table = useMemo(() => {
    const ws = weekStart();
    const res = students.map((s) => {
      const cum: Agg = { att: 0, attN: 0, hw: 0, hwN: 0 };
      const wk: Agg = { att: 0, attN: 0, hw: 0, hwN: 0 };
      rows.filter((r) => r.student_id === s.id).forEach((r) => {
        const targets = [cum, ...(r.date && r.date >= ws ? [wk] : [])];
        targets.forEach((t) => {
          if (r.status in ATT_SCORE) { t.att += ATT_SCORE[r.status]; t.attN++; }
          if (r.homework_status in HW_SCORE) { t.hw += HW_SCORE[r.homework_status]; t.hwN++; }
        });
      });
      const cAtt = pct(cum.att, cum.attN), cHw = pct(cum.hw, cum.hwN);
      return { ...s, wAtt: pct(wk.att, wk.attN), wHw: pct(wk.hw, wk.hwN), cAtt, cHw, total: (cAtt + cHw) / 2 };
    }).sort((a, b) => b.total - a.total);
    let rank = 0, prev = -1;
    return res.map((r, i) => { if (r.total !== prev) { rank = i + 1; prev = r.total; } return { ...r, rank }; });
  }, [rows, students]);

  const print = () => {
    const w = window.open("", "_blank"); if (!w) return;
    w.document.write(`<html dir="rtl"><head><title>نتائج ${halaqa?.name}</title><style>body{font-family:Tahoma;padding:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #999;padding:6px;text-align:center}th{background:#e8e0c8}</style></head><body><h2 style="text-align:center">نتائج حلقة ${halaqa?.name}</h2><table><tr><th>المركز</th><th>الطالب</th><th>حضور الأسبوع</th><th>واجب الأسبوع</th><th>حضور تراكمي</th><th>واجب تراكمي</th><th>المجموع</th></tr>${table.map((r) => `<tr><td>${r.rank}</td><td>${r.full_name}</td><td>${r.wAtt}%</td><td>${r.wHw}%</td><td>${r.cAtt}%</td><td>${r.cHw}%</td><td>${r.total}%</td></tr>`).join("")}</table><script>onload=()=>print()</script></body></html>`);
    w.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2">
            <span>نتائج الطلاب — {halaqa?.name}</span>
            <Button size="sm" variant="outline" onClick={print}><Printer className="w-4 h-4 ml-1" />طباعة</Button>
          </DialogTitle>
        </DialogHeader>
        {loading ? <p className="text-center text-muted-foreground py-6">جارٍ التحميل...</p> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-center">المركز</TableHead>
                <TableHead>الطالب</TableHead>
                <TableHead className="text-center">حضور الأسبوع</TableHead>
                <TableHead className="text-center">واجب الأسبوع</TableHead>
                <TableHead className="text-center">حضور تراكمي</TableHead>
                <TableHead className="text-center">واجب تراكمي</TableHead>
                <TableHead className="text-center">المجموع</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {table.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-center font-bold text-primary">{r.rank}</TableCell>
                  <TableCell>{r.full_name}</TableCell>
                  <TableCell className="text-center">{r.wAtt}%</TableCell>
                  <TableCell className="text-center">{r.wHw}%</TableCell>
                  <TableCell className="text-center">{r.cAtt}%</TableCell>
                  <TableCell className="text-center">{r.cHw}%</TableCell>
                  <TableCell className="text-center font-bold">{r.total}%</TableCell>
                </TableRow>
              ))}
              {!table.length && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground">لا يوجد طلاب</TableCell></TableRow>}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  );
};
