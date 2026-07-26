import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import PageDateHeader from "@/components/PageDateHeader";
import ProgramCard, { type ProgramMetric } from "@/components/programs/ProgramCard";
import { PROGRAMS, type ProgramKey } from "@/lib/programs";

/** Rows for the two tables whose supervisor_id is newer than the generated types. */
interface SupervisedProgramRow {
  id: string;
  name?: string;
  status?: string;
  supervisor_id: string | null;
}

interface ProgramSummary {
  metrics: ProgramMetric[];
  footnote?: string;
  supervisorName?: string | null;
}

const ProgramsOverview = () => {
  const { hasAccess } = useRole();
  const [loading, setLoading] = useState(true);
  const [summaries, setSummaries] = useState<Partial<Record<ProgramKey, ProgramSummary>>>({});

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
      const today = now.toISOString().split("T")[0];

      const [
        eliteRes, sessionsRes, perfRes,
        enrollRes, examsRes,
        narrSessionsRes, narrAttemptsRes,
        summerProgramRes, talqeenCurriculaRes, talqeenSessionsRes,
      ] = await Promise.all([
        supabase.from("excellence_elite_students").select("id", { count: "exact", head: true }),
        supabase.from("excellence_sessions").select("session_date").order("session_date", { ascending: false }).limit(1),
        supabase.from("excellence_performance").select("total_score").gte("created_at", monthStart + "T00:00:00"),
        supabase.from("madarij_enrollments").select("id, track_id, status").eq("status", "active"),
        supabase.from("madarij_hizb_exams").select("passed").gte("created_at", monthStart + "T00:00:00"),
        supabase.from("narration_sessions" as any).select("id").gte("session_date", monthStart),
        supabase.from("narration_attempts").select("status, total_hizb_count").gte("created_at", monthStart + "T00:00:00"),
        (supabase as any).from("summer_programs").select("id, name, status, supervisor_id, start_date, end_date")
          .order("start_date", { ascending: false }).limit(1),
        (supabase as any).from("talqeen_curricula").select("id, supervisor_id").eq("active", true),
        supabase.from("talqeen_sessions")
          .select("attendance_done, lesson_done, tarbia_done, homework_checked")
          .gte("session_date", monthStart).lte("session_date", today),
      ]);

      const next: Partial<Record<ProgramKey, ProgramSummary>> = {};

      // Excellence
      const perfArr = perfRes.data || [];
      const avgScore = perfArr.length
        ? Math.round(perfArr.reduce((s, p) => s + Number(p.total_score || 0), 0) / perfArr.length)
        : 0;
      next.excellence = {
        metrics: [
          { value: eliteRes.count || 0, label: "طالب متميز" },
          { value: avgScore, label: "متوسط الدرجة" },
        ],
        footnote: `آخر جلسة: ${sessionsRes.data?.[0]?.session_date || "—"}`,
      };

      // Madarij
      const examsArr = examsRes.data || [];
      const passedExams = examsArr.filter((e) => e.passed).length;
      next.madarij = {
        metrics: [
          { value: (enrollRes.data || []).length, label: "مسجّل نشط" },
          { value: passedExams, label: "أحزاب مكتملة" },
        ],
        footnote: `نسبة الاجتياز: ${examsArr.length ? Math.round((passedExams / examsArr.length) * 100) : 0}%`,
      };

      // Narration
      const narrAttempts = narrAttemptsRes.data || [];
      const narrPassed = narrAttempts.filter((a) => a.status === "pass" || a.status === "passed").length;
      next.narration = {
        metrics: [
          { value: (narrSessionsRes.data || []).length, label: "جلسة هذا الشهر" },
          { value: narrAttempts.reduce((sum, a) => sum + (a.total_hizb_count || 0), 0), label: "إجمالي الأحزاب" },
        ],
        footnote: `نسبة الاجتياز: ${narrAttempts.length ? Math.round((narrPassed / narrAttempts.length) * 100) : 0}%`,
      };

      // Summer — the latest programme, with its maqare and enrolled students
      const summerProgram = (summerProgramRes.data as SupervisedProgramRow[] | null)?.[0];
      let summerMaqare = 0;
      let summerStudents = 0;
      if (summerProgram) {
        const { data: maqare } = await supabase
          .from("summer_maqare").select("id").eq("program_id", summerProgram.id);
        summerMaqare = (maqare || []).length;
        const mIds = (maqare || []).map((m) => m.id);
        if (mIds.length) {
          const { count } = await supabase
            .from("summer_students")
            .select("id", { count: "exact", head: true })
            .in("maqra_id", mIds)
            .eq("active", true);
          summerStudents = count || 0;
        }
      }
      next.summer = {
        metrics: [
          { value: summerMaqare, label: "مقرأة" },
          { value: summerStudents, label: "طالب مسجّل" },
        ],
        footnote: summerProgram
          ? `${summerProgram.name} — ${summerProgram.status === "active" ? "جارٍ" : "غير نشط"}`
          : "لا يوجد برنامج صيفي",
      };

      // Talqeen — active halaqat and how many days were fully executed this month
      const { count: talqeenHalaqat } = await (supabase as any)
        .from("halaqat_talqeen_only").select("id", { count: "exact", head: true }).eq("active", true);
      const talqeenSessions = talqeenSessionsRes.data || [];
      const fullyDone = talqeenSessions.filter(
        (s) => s.attendance_done && s.lesson_done && s.tarbia_done && s.homework_checked,
      ).length;
      next.talqeen = {
        metrics: [
          { value: talqeenHalaqat || 0, label: "حلقة تلقين" },
          { value: talqeenSessions.length, label: "يوم مسجّل" },
        ],
        footnote: `اكتمال التنفيذ: ${talqeenSessions.length ? Math.round((fullyDone / talqeenSessions.length) * 100) : 0}%`,
      };

      // Resolve supervisor names for the programmes that carry one
      const supervisorIds = [
        summerProgram?.supervisor_id,
        ...((talqeenCurriculaRes.data as SupervisedProgramRow[] | null) || []).map((c) => c.supervisor_id),
      ].filter(Boolean);
      if (supervisorIds.length) {
        const { data: profiles } = await supabase
          .from("profiles").select("id, full_name").in("id", supervisorIds as string[]);
        const byId = new Map((profiles || []).map((p) => [p.id, p.full_name]));
        if (summerProgram?.supervisor_id) {
          next.summer!.supervisorName = byId.get(summerProgram.supervisor_id) ?? null;
        }
        const talqeenSupervisor = ((talqeenCurriculaRes.data as SupervisedProgramRow[] | null) || []).find((c) => c.supervisor_id);
        if (talqeenSupervisor?.supervisor_id) {
          next.talqeen!.supervisorName = byId.get(talqeenSupervisor.supervisor_id) ?? null;
        }
      }

      setSummaries(next);
      setLoading(false);
    };
    fetchAll();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Only show programmes the current role can actually open.
  const visible = PROGRAMS.filter((p) => hasAccess(p.route));

  return (
    <div className="space-y-6 animate-fade-in" dir="rtl">
      <PageDateHeader />
      <div>
        <h1 className="text-2xl font-bold">إشراف البرامج</h1>
        <p className="text-muted-foreground text-sm">
          نظرة عامة على كل برنامج على حدة، مع المشرف المسؤول ورابط مواده الإثرائية
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {visible.map((program) => {
          const summary = summaries[program.key];
          return (
            <ProgramCard
              key={program.key}
              program={program}
              metrics={summary?.metrics ?? []}
              footnote={summary?.footnote}
              supervisorName={summary?.supervisorName}
            />
          );
        })}
      </div>

      {visible.length === 0 && (
        <p className="text-center text-muted-foreground py-8">لا توجد برامج متاحة لصلاحيتك.</p>
      )}
    </div>
  );
};

export default ProgramsOverview;
