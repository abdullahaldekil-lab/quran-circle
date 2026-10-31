import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileDown } from "lucide-react";
import { toast } from "sonner";
import { useRole } from "@/hooks/useRole";
import { fetchMyHalaqat, currentSchoolWeek } from "@/lib/myHalaqat";

const DAY_NAMES = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const MARK: Record<string, string> = { present: "✓", late: "تأخر", late_excused: "تأخر بعذر", absent: "غائب", excused: "مستأذن" };

const daysBetween = (from: string, to: string) => {
  const out: string[] = [];
  const d = new Date(from + "T00:00:00");
  const end = new Date(to + "T00:00:00");
  while (d <= end && out.length < 31) {
    if (d.getDay() <= 4) out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
    d.setDate(d.getDate() + 1);
  }
  return out;
};

const WeeklyAttendancePdf = () => {
  const { isTeacher } = useRole();
  const [halaqat, setHalaqat] = useState<{ id: string; name: string }[]>([]);
  const [halaqaId, setHalaqaId] = useState("");
  const week = currentSchoolWeek();
  const [from, setFrom] = useState(week.from);
  const [to, setTo] = useState(week.to);
  const [students, setStudents] = useState<{ id: string; full_name: string }[]>([]);
  const [att, setAtt] = useState<{ student_id: string; attendance_date: string; status: string; notes: string | null }[]>([]);
  const [teacher, setTeacher] = useState("");
  const [busy, setBusy] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetchMyHalaqat(isTeacher).then((l) => { setHalaqat(l); if (l[0]) setHalaqaId((p) => p || l[0].id); }); }, [isTeacher]);

  useEffect(() => {
    if (!halaqaId) return;
    (async () => {
      const [{ data: sts }, { data: h }] = await Promise.all([
        supabase.from("students").select("id, full_name").eq("halaqa_id", halaqaId).eq("status", "active").order("full_name"),
        supabase.from("halaqat").select("teacher_id").eq("id", halaqaId).maybeSingle(),
      ]);
      setStudents(sts || []);
      if (h?.teacher_id) {
        const { data: p } = await supabase.from("profiles").select("full_name").eq("id", h.teacher_id).maybeSingle();
        setTeacher(p?.full_name || "");
      } else setTeacher("");
      const ids = (sts || []).map((s) => s.id);
      if (!ids.length) return setAtt([]);
      const { data } = await supabase.from("attendance").select("student_id, attendance_date, status, notes").in("student_id", ids).gte("attendance_date", from).lte("attendance_date", to).is("archived_at", null);
      setAtt((data as any) || []);
    })();
  }, [halaqaId, from, to]);

  const days = useMemo(() => daysBetween(from, to), [from, to]);
  const halaqaName = halaqat.find((h) => h.id === halaqaId)?.name || "";
  const rows = useMemo(() => students.map((s) => {
    const a = att.filter((x) => x.student_id === s.id);
    const byDay: Record<string, string> = {};
    a.forEach((x) => { byDay[x.attendance_date] = x.status; });
    const present = a.filter((x) => x.status === "present").length;
    const late = a.filter((x) => x.status === "late" || x.status === "late_excused").length;
    const absent = a.filter((x) => x.status === "absent").length;
    const excused = a.filter((x) => x.status === "excused").length;
    const rate = a.length ? Math.round(((present + late) / a.length) * 100) : 0;
    return { ...s, byDay, present, late, absent, excused, rate };
  }), [students, att]);

  const details = useMemo(() => att
    .filter((x) => ["absent", "late", "late_excused", "excused"].includes(x.status))
    .sort((a, b) => a.attendance_date.localeCompare(b.attendance_date))
    .map((x) => ({ ...x, name: students.find((s) => s.id === x.student_id)?.full_name || "" })), [att, students]);

  const totals = rows.reduce((t, r) => ({ p: t.p + r.present, l: t.l + r.late, a: t.a + r.absent, e: t.e + r.excused }), { p: 0, l: 0, a: 0, e: 0 });
  const avgRate = rows.length ? Math.round(rows.reduce((t, r) => t + r.rate, 0) / rows.length) : 0;

  const exportPdf = async () => {
    if (!reportRef.current) return;
    setBusy(true);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([import("html2canvas"), import("jspdf")]);
      const canvas = await html2canvas(reportRef.current, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
      const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const pw = pdf.internal.pageSize.getWidth(), ph = pdf.internal.pageSize.getHeight(), m = 8;
      const w = pw - m * 2;
      const pageHpx = ((ph - m * 2) * canvas.width) / w;
      for (let y = 0, i = 0; y < canvas.height; y += pageHpx, i++) {
        const slice = document.createElement("canvas");
        slice.width = canvas.width; slice.height = Math.min(pageHpx, canvas.height - y);
        slice.getContext("2d")!.drawImage(canvas, 0, -y);
        if (i) pdf.addPage();
        pdf.addImage(slice.toDataURL("image/jpeg", 0.92), "JPEG", m, m, w, (slice.height * w) / canvas.width);
      }
      pdf.save(`تقرير_حضور_${halaqaName}_${from}_${to}.pdf`);
    } catch (e: any) {
      toast.error("تعذر إنشاء الملف: " + (e?.message || ""));
    }
    setBusy(false);
  };

  const cell = "border border-border px-2 py-1 text-center";

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">تقرير الحضور الأسبوعي للحلقة (PDF)</h1>
        <p className="text-muted-foreground">تقرير جاهز لاجتماعات المدرسة بتفاصيل الغياب والتأخير</p>
      </div>
      <Card><CardContent className="pt-6 grid gap-4 md:grid-cols-4">
        <div><Label>الحلقة</Label>
          <Select value={halaqaId} onValueChange={setHalaqaId}><SelectTrigger><SelectValue placeholder="اختر الحلقة" /></SelectTrigger>
            <SelectContent>{halaqat.map((h) => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>من</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div><Label>إلى</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
        <div className="flex items-end"><Button className="w-full" onClick={exportPdf} disabled={busy || !halaqaId}><FileDown className="w-4 h-4 ml-2" />{busy ? "جارٍ الإنشاء..." : "تنزيل PDF"}</Button></div>
      </CardContent></Card>

      <div className="overflow-x-auto">
        <div ref={reportRef} dir="rtl" className="bg-card text-card-foreground p-6 min-w-[900px] space-y-4">
          <div className="text-center space-y-1">
            <h2 className="text-xl font-bold">تقرير الحضور الأسبوعي</h2>
            <p>الحلقة: <b>{halaqaName}</b>{teacher && <> — المعلم: <b>{teacher}</b></>}</p>
            <p className="text-sm">الفترة: {from} إلى {to}</p>
          </div>
          <div className="grid grid-cols-6 gap-2 text-center text-sm">
            {[["عدد الطلاب", rows.length], ["حضور", totals.p], ["تأخر", totals.l], ["غياب", totals.a], ["استئذان", totals.e], ["متوسط الانتظام", `${avgRate}%`]].map(([k, v]) => (
              <div key={k as string} className="border border-border rounded p-2"><div className="text-muted-foreground">{k}</div><div className="font-bold text-lg">{v}</div></div>
            ))}
          </div>
          <table className="w-full border-collapse text-sm">
            <thead><tr className="bg-muted">
              <th className={cell}>م</th><th className={cell}>الطالب</th>
              {days.map((d) => <th key={d} className={cell}>{DAY_NAMES[new Date(d + "T00:00:00").getDay()]}<div className="text-xs font-normal">{d.slice(5)}</div></th>)}
              <th className={cell}>حضور</th><th className={cell}>تأخر</th><th className={cell}>غياب</th><th className={cell}>استئذان</th><th className={cell}>النسبة</th>
            </tr></thead>
            <tbody>
              {rows.map((r, i) => <tr key={r.id}>
                <td className={cell}>{i + 1}</td><td className={`${cell} text-right`}>{r.full_name}</td>
                {days.map((d) => { const s = r.byDay[d]; return <td key={d} className={`${cell} ${s === "absent" ? "text-destructive font-bold" : s?.startsWith("late") ? "text-accent-foreground font-semibold" : ""}`}>{s ? MARK[s] || s : "—"}</td>; })}
                <td className={cell}>{r.present}</td><td className={cell}>{r.late}</td><td className={`${cell} ${r.absent ? "text-destructive font-bold" : ""}`}>{r.absent}</td><td className={cell}>{r.excused}</td><td className={cell}>{r.rate}%</td>
              </tr>)}
            </tbody>
          </table>
          <div>
            <h3 className="font-bold mb-2">تفاصيل الغياب والتأخير</h3>
            {details.length === 0 ? <p className="text-sm text-muted-foreground">لا يوجد غياب أو تأخير في هذه الفترة.</p> : (
              <table className="w-full border-collapse text-sm">
                <thead><tr className="bg-muted"><th className={cell}>التاريخ</th><th className={cell}>اليوم</th><th className={cell}>الطالب</th><th className={cell}>الحالة</th><th className={cell}>ملاحظات</th></tr></thead>
                <tbody>{details.map((x, i) => <tr key={i}>
                  <td className={cell}>{x.attendance_date}</td><td className={cell}>{DAY_NAMES[new Date(x.attendance_date + "T00:00:00").getDay()]}</td>
                  <td className={`${cell} text-right`}>{x.name}</td><td className={cell}>{MARK[x.status]}</td><td className={`${cell} text-right`}>{x.notes || "—"}</td>
                </tr>)}</tbody>
              </table>)}
          </div>
          <div className="grid grid-cols-2 gap-8 pt-6 text-sm"><p>توقيع المعلم: ....................</p><p>توقيع المشرف: ....................</p></div>
        </div>
      </div>
    </div>
  );
};

export default WeeklyAttendancePdf;
