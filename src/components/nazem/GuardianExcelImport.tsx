import { useRef, useState } from "react";
import * as XLSX from "xlsx-js-style";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Download, Upload } from "lucide-react";
import { toast } from "sonner";

const H = { id: "رقم هوية الطالب", name: "اسم الطالب", gname: "اسم ولي الأمر", gphone: "جوال ولي الأمر", gwork: "عمل ولي الأمر" };

type Stu = { id: string; full_name: string; national_id: string | null; guardian_name: string | null; guardian_phone: string | null; guardian_work: string | null };
type Plan = { student: Stu | null; rowNo: number; label: string; patch: Record<string, string>; error?: string };

const norm = (s: unknown) => String(s ?? "").trim().replace(/\s+/g, " ");
const normName = (s: string) => norm(s).replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي");
const normPhone = (s: string) => {
  let d = s.replace(/[٠-٩]/g, (c) => String("٠١٢٣٤٥٦٧٨٩".indexOf(c))).replace(/\D/g, "");
  if (d.startsWith("00966")) d = d.slice(5);
  else if (d.startsWith("966")) d = d.slice(3);
  if (d.length === 9 && d.startsWith("5")) d = "0" + d;
  return d;
};

const fetchStudents = async (halaqaId: string, onlyMissing: boolean) => {
  let q = supabase.from("students")
    .select("id, full_name, national_id, guardian_name, guardian_phone, guardian_work")
    .in("status", ["active", "inactive"]).order("full_name").limit(1000);
  if (halaqaId !== "all") q = q.eq("halaqa_id", halaqaId);
  if (onlyMissing) q = q.or("guardian_work.is.null,guardian_work.eq.,guardian_name.is.null,guardian_name.eq.,guardian_phone.is.null,guardian_phone.eq.");
  const { data, error } = await q;
  if (error) throw error;
  return (data as Stu[]) || [];
};

const GuardianExcelImport = ({ halaqaId, onDone }: { halaqaId: string; onDone: () => void }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [busy, setBusy] = useState(false);

  const download = async () => {
    try {
      const list = await fetchStudents(halaqaId, true);
      const rows = list.map((s) => ({ [H.id]: s.national_id || "", [H.name]: s.full_name, [H.gname]: s.guardian_name || "", [H.gphone]: s.guardian_phone || "", [H.gwork]: s.guardian_work || "" }));
      const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ [H.id]: "", [H.name]: "", [H.gname]: "", [H.gphone]: "", [H.gwork]: "" }]);
      ws["!cols"] = [{ wch: 16 }, { wch: 30 }, { wch: 26 }, { wch: 16 }, { wch: 22 }];
      ws["!views"] = [{ RTL: true }];
      Object.keys(ws).filter((k) => /^[A-E]1$/.test(k)).forEach((k) => {
        ws[k].s = { font: { bold: true, name: "Arial" }, fill: { fgColor: { rgb: "D9EAD3" } }, alignment: { horizontal: "center" } };
      });
      const wb = XLSX.utils.book_new();
      wb.Workbook = { Views: [{ RTL: true }] };
      XLSX.utils.book_append_sheet(wb, ws, "بيانات أولياء الأمور");
      XLSX.writeFile(wb, "نواقص_بيانات_أولياء_الأمور.xlsx");
    } catch (e: any) { toast.error(e.message || "تعذر التنزيل"); }
  };

  const onFile = async (f: File) => {
    setBusy(true);
    try {
      const wb = XLSX.read(await f.arrayBuffer());
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { defval: "" });
      if (!raw.length || !(H.name in raw[0] || H.id in raw[0])) throw new Error("الأعمدة غير مطابقة للقالب — نزّل القالب واستخدمه");
      const all = await fetchStudents(halaqaId, false);
      const byId = new Map(all.filter((s) => s.national_id).map((s) => [norm(s.national_id), s]));
      const byName = new Map<string, Stu[]>();
      all.forEach((s) => { const k = normName(s.full_name); byName.set(k, [...(byName.get(k) || []), s]); });

      const result: Plan[] = raw.map((r, i) => {
        const id = norm(r[H.id]); const name = norm(r[H.name]);
        const label = name || id;
        let st = id ? byId.get(id) || null : null;
        if (!st && name) {
          const m = byName.get(normName(name)) || [];
          if (m.length > 1) return { student: null, rowNo: i + 2, label, patch: {}, error: "الاسم مكرر — أضف رقم الهوية" };
          st = m[0] || null;
        }
        if (!st) return { student: null, rowNo: i + 2, label, patch: {}, error: "الطالب غير موجود" };
        const patch: Record<string, string> = {};
        const gname = norm(r[H.gname]); const gwork = norm(r[H.gwork]); const gphoneRaw = norm(r[H.gphone]);
        if (gname && gname !== st.guardian_name) patch.guardian_name = gname;
        if (gwork && gwork !== st.guardian_work) patch.guardian_work = gwork;
        if (gphoneRaw) {
          const p = normPhone(gphoneRaw);
          if (!/^05\d{8}$/.test(p)) return { student: st, rowNo: i + 2, label, patch: {}, error: `رقم جوال غير صالح: ${gphoneRaw}` };
          if (p !== st.guardian_phone) patch.guardian_phone = p;
        }
        return { student: st, rowNo: i + 2, label, patch };
      }).filter((p) => p.error || Object.keys(p.patch).length);
      setPlans(result);
    } catch (e: any) { toast.error(e.message || "تعذر قراءة الملف"); }
    finally { setBusy(false); if (fileRef.current) fileRef.current.value = ""; }
  };

  const valid = plans?.filter((p) => !p.error && p.student) || [];
  const apply = async () => {
    setBusy(true);
    let ok = 0, fail = 0;
    for (const p of valid) {
      const { error } = await supabase.from("students").update(p.patch).eq("id", p.student!.id);
      error ? fail++ : ok++;
    }
    setBusy(false); setPlans(null);
    toast.success(`تم تحديث ${ok} طالب${fail ? ` — فشل ${fail}` : ""}`);
    onDone();
  };

  const L: Record<string, string> = { guardian_name: "الاسم", guardian_phone: "الجوال", guardian_work: "العمل" };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={download}><Download className="w-4 h-4 ml-1" />تنزيل الناقصين Excel</Button>
        <Button size="sm" onClick={() => fileRef.current?.click()} disabled={busy}><Upload className="w-4 h-4 ml-1" />استيراد Excel المحدَّث</Button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
      </div>
      <Dialog open={!!plans} onOpenChange={(o) => !o && setPlans(null)}>
        <DialogContent className="max-w-3xl" dir="rtl">
          <DialogHeader><DialogTitle>معاينة الاستيراد</DialogTitle></DialogHeader>
          <div className="flex gap-2 text-sm">
            <Badge>{valid.length} سيُحدَّث</Badge>
            <Badge variant="destructive">{(plans?.length || 0) - valid.length} خطأ</Badge>
          </div>
          <div className="max-h-[400px] overflow-y-auto border rounded-md">
            <table className="w-full text-sm">
              <thead className="bg-muted sticky top-0"><tr><th className="p-2 text-right">صف</th><th className="p-2 text-right">الطالب</th><th className="p-2 text-right">التغييرات</th></tr></thead>
              <tbody>
                {plans?.map((p) => (
                  <tr key={p.rowNo} className={`border-t ${p.error ? "bg-destructive/10" : ""}`}>
                    <td className="p-2">{p.rowNo}</td>
                    <td className="p-2">{p.student?.full_name || p.label}</td>
                    <td className="p-2">{p.error ? <span className="text-destructive">{p.error}</span> :
                      Object.entries(p.patch).map(([k, v]) => <div key={k}><b>{L[k]}:</b> {v}</div>)}</td>
                  </tr>
                ))}
                {plans?.length === 0 && <tr><td colSpan={3} className="p-4 text-center text-muted-foreground">لا توجد تغييرات جديدة في الملف</td></tr>}
              </tbody>
            </table>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlans(null)}>إلغاء</Button>
            <Button onClick={apply} disabled={busy || !valid.length}>تطبيق ({valid.length})</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default GuardianExcelImport;
