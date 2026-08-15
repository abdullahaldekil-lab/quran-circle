import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, ChevronRight, ChevronLeft } from "lucide-react";
import { formatDateSmart } from "@/lib/hijri";
import {
  rankBy, recordCommitment, shiftWeek, sumAxes, weekEnd, weekStart,
  type LeaderboardAxis, type LeaderboardEntry,
} from "@/lib/tarbawi";

const AXES: { key: LeaderboardAxis; label: string; unit: string }[] = [
  { key: "overall", label: "الأفضل عموماً", unit: "%" },
  { key: "attendance", label: "الحضور", unit: " جلسة" },
  { key: "memorization", label: "الحفظ", unit: " مرة" },
  { key: "listening", label: "السماع", unit: " دقيقة" },
  { key: "reading", label: "القراءة", unit: " صفحة" },
];

export default function TarbawiLeaderboard() {
  const [period, setPeriod] = useState<"week" | "month">("week");
  const [anchor, setAnchor] = useState(weekStart(new Date()));
  const [programs, setPrograms] = useState<any[]>([]);
  const [programId, setProgramId] = useState<string>("all");
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const range = useMemo(() => {
    if (period === "week") return { from: anchor, to: weekEnd(anchor) };
    const d = new Date(anchor + "T00:00:00Z");
    const from = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
    const to = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
    return { from: from.toISOString().split("T")[0], to: to.toISOString().split("T")[0] };
  }, [period, anchor]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: progs } = await (supabase as any)
      .from("tarbawi_programs").select("id, name").order("created_at", { ascending: false });
    setPrograms(progs || []);

    let q = (supabase as any)
      .from("tarbawi_weekly_records").select("*")
      .gte("week_start", range.from).lte("week_start", range.to);
    if (programId !== "all") q = q.eq("program_id", programId);
    const { data: recs } = await q;

    const byStudent = new Map<string, any[]>();
    (recs || []).forEach((r: any) => {
      byStudent.set(r.student_id, [...(byStudent.get(r.student_id) || []), r]);
    });
    const ids = [...byStudent.keys()];
    if (!ids.length) { setEntries([]); setLoading(false); return; }

    const { data: studs } = await supabase
      .from("students").select("id, full_name, halaqa_id").in("id", ids);
    const { data: hals } = await supabase.from("halaqat").select("id, name");
    const halNames = Object.fromEntries((hals || []).map((h: any) => [h.id, h.name]));

    const list: LeaderboardEntry[] = (studs || []).map((s: any) => {
      const rows = byStudent.get(s.id) || [];
      return {
        student_id: s.id,
        student_name: s.full_name,
        halaqa_name: halNames[s.halaqa_id] || "—",
        totals: sumAxes(rows),
        commitment: Math.round(
          rows.reduce((sum, r) => sum + recordCommitment(r), 0) / (rows.length || 1),
        ),
      };
    });
    setEntries(list);
    setLoading(false);
  }, [range.from, range.to, programId]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="container mx-auto px-4 py-6 max-w-4xl" dir="rtl">
      <h1 className="text-xl font-bold flex items-center gap-2 mb-4">
        <Trophy className="w-5 h-5 text-amber-500" /> لوحة الصدارة والتميز
      </h1>

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <Tabs value={period} onValueChange={(v) => setPeriod(v as "week" | "month")}>
          <TabsList>
            <TabsTrigger value="week">أسبوعي</TabsTrigger>
            <TabsTrigger value="month">شهري</TabsTrigger>
          </TabsList>
        </Tabs>
        <Select value={programId} onValueChange={setProgramId}>
          <SelectTrigger className="h-9 w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل البرامج</SelectItem>
            {programs.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1">
          <Button size="icon" variant="outline" className="h-9 w-9" aria-label="الفترة السابقة"
            onClick={() => setAnchor(shiftWeek(anchor, period === "week" ? -1 : -4))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <span className="text-xs px-2">{formatDateSmart(range.from)} — {formatDateSmart(range.to)}</span>
          <Button size="icon" variant="outline" className="h-9 w-9" aria-label="الفترة التالية"
            onClick={() => setAnchor(shiftWeek(anchor, period === "week" ? 1 : 4))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {loading && <p className="text-sm text-muted-foreground">جارٍ التحميل...</p>}
      {!loading && entries.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-10">لا توجد بيانات متابعة في هذه الفترة</p>
      )}

      {!loading && entries.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {AXES.map((axis) => {
            const top = rankBy(entries, axis.key, 5);
            return (
              <Card key={axis.key} className="border-2">
                <CardHeader className="pb-2"><CardTitle className="text-sm">{axis.label}</CardTitle></CardHeader>
                <CardContent className="space-y-2">
                  {top.map((e, i) => (
                    <div key={e.student_id} className="flex items-center gap-2 text-xs">
                      <Badge variant={i === 0 ? "default" : "outline"} className="w-6 justify-center">{i + 1}</Badge>
                      <span className="flex-1 font-medium truncate">{e.student_name}</span>
                      <span className="text-muted-foreground truncate max-w-24">{e.halaqa_name}</span>
                      <Badge variant="secondary">
                        {(e as any)[axis.key]}{axis.unit}
                      </Badge>
                    </div>
                  ))}
                  {top.length === 0 && <p className="text-xs text-muted-foreground">لا توجد نتائج</p>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
