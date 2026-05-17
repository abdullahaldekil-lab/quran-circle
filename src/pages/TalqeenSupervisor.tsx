import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BookOpen } from "lucide-react";
import { formatDateSmart } from "@/lib/hijri";

const INDICATORS = [
  { key: "attendance_done", label: "الحضور", icon: "👥" },
  { key: "lesson_done", label: "الشرح", icon: "📖" },
  { key: "tarbia_done", label: "التربوي", icon: "💚" },
  { key: "homework_checked", label: "الواجبات", icon: "📋" },
] as const;

export default function TalqeenSupervisor() {
  const today = new Date().toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState(today);
  const [halaqat, setHalaqat] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);

  const fetchHalaqat = useCallback(async () => {
    const { data } = await (supabase as any)
      .from("halaqat")
      .select("id, name, teacher_id")
      .eq("active", true)
      .not("talqeen_curriculum_id", "is", null);
    const list = data || [];
    const teacherIds = [...new Set(list.map((h: any) => h.teacher_id).filter(Boolean))];
    let profilesMap: Record<string, string> = {};
    if (teacherIds.length) {
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", teacherIds);
      profilesMap = Object.fromEntries((profs || []).map((p: any) => [p.id, p.full_name]));
    }
    setHalaqat(list.map((h: any) => ({ ...h, teacher_name: profilesMap[h.teacher_id] || "غير محدد" })));
  }, []);

  const fetchSessions = useCallback(async () => {
    const { data } = await (supabase as any)
      .from("talqeen_sessions")
      .select("*")
      .eq("session_date", selectedDate);
    setSessions(data || []);
  }, [selectedDate]);

  useEffect(() => { fetchHalaqat(); }, [fetchHalaqat]);
  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  useEffect(() => {
    const channel = supabase
      .channel("talqeen-supervisor-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "talqeen_sessions", filter: `session_date=eq.${selectedDate}` },
        () => fetchSessions()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedDate, fetchSessions]);

  const getSession = (halaqaId: string) => sessions.find((s) => s.halaqa_id === halaqaId);
  const completedCount = halaqat.filter((h) => {
    const s = getSession(h.id);
    return s && INDICATORS.every((i) => s[i.key]);
  }).length;

  return (
    <div className="container mx-auto px-4 py-6 max-w-5xl" dir="rtl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-foreground">متابعة التلقين اليومية</h1>
          <p className="text-sm text-muted-foreground">{formatDateSmart(selectedDate)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-40 h-9 text-sm"
          />
          <Badge className="bg-green-100 text-green-800 hover:bg-green-100 text-sm px-3 py-1">
            {completedCount}/{halaqat.length} مكتملة
          </Badge>
        </div>
      </div>

      <div className="space-y-3">
        {halaqat.map((h) => {
          const session = getSession(h.id);
          const doneCount = INDICATORS.filter((i) => session?.[i.key]).length;
          const allDone = doneCount === INDICATORS.length;

          return (
            <div
              key={h.id}
              className={`rounded-2xl border-2 p-4 transition-all ${
                allDone ? "border-green-300 bg-green-50/50" : "border-border bg-card"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-bold text-sm text-foreground">{h.teacher_name}</p>
                  <p className="text-xs text-muted-foreground">{h.name}</p>
                </div>
                {allDone ? (
                  <Badge className="bg-green-500 hover:bg-green-500 text-white text-xs">مكتمل ✅</Badge>
                ) : (
                  <Badge variant="outline" className="text-xs text-amber-600 border-amber-300">
                    {doneCount}/{INDICATORS.length} منجز
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-4 gap-2">
                {INDICATORS.map((ind) => (
                  <div
                    key={ind.key}
                    className={`flex flex-col items-center gap-1 p-2 rounded-xl ${
                      session?.[ind.key] ? "bg-green-100" : "bg-muted"
                    }`}
                  >
                    <span className="text-lg">{session?.[ind.key] ? "✅" : "⭕"}</span>
                    <span className="text-[10px] text-center font-medium text-muted-foreground">
                      {ind.label}
                    </span>
                  </div>
                ))}
              </div>

              {session && (
                <p className="text-[10px] text-muted-foreground mt-2 text-left">
                  آخر تحديث:{" "}
                  {session.executed_at
                    ? new Date(session.executed_at).toLocaleTimeString("ar-SA", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "—"}
                </p>
              )}
            </div>
          );
        })}

        {halaqat.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>لا توجد حلقات تلقين نشطة</p>
          </div>
        )}
      </div>
    </div>
  );
}
