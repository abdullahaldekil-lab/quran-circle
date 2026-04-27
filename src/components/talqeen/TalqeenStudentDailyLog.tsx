import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Heart, CheckCircle2, Circle, Calendar } from "lucide-react";
import { formatDateSmart } from "@/lib/hijri";

interface Props {
  halaqaId: string | null;
  mode: "lesson" | "values";
}

interface Session {
  id: string;
  session_date: string;
  surah: string;
  from_ayah: number | null;
  to_ayah: number | null;
  executed: boolean;
  executed_at: string | null;
  execution_notes: string | null;
  homework: string | null;
  homework_due_date: string | null;
  educational_program_title: string | null;
  educational_program_details: string | null;
  notes: string | null;
}

const TalqeenStudentDailyLog = ({ halaqaId, mode }: Props) => {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!halaqaId) {
      setSessions([]);
      setLoading(false);
      return;
    }
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("talqeen_sessions")
        .select("*")
        .eq("halaqa_id", halaqaId)
        .order("session_date", { ascending: false })
        .limit(30);
      setSessions((data as Session[]) || []);
      setLoading(false);
    })();
  }, [halaqaId, mode]);

  if (!halaqaId) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          لا توجد حلقة مرتبطة بهذا الطالب
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">جاري التحميل...</CardContent>
      </Card>
    );
  }

  const filtered =
    mode === "values"
      ? sessions.filter((s) => s.educational_program_title || s.educational_program_details)
      : sessions;

  if (filtered.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          {mode === "lesson" ? "لا توجد دروس مسجلة بعد" : "لا توجد قيم تربوية مسجلة بعد"}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-3">
        {filtered.map((s) => (
          <div key={s.id} className="border rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                {mode === "lesson" ? (
                  <BookOpen className="w-4 h-4 text-primary" />
                ) : (
                  <Heart className="w-4 h-4 text-rose-500" />
                )}
                <span>
                  {mode === "lesson"
                    ? `${s.surah}${s.from_ayah && s.to_ayah ? ` (${s.from_ayah} - ${s.to_ayah})` : ""}`
                    : s.educational_program_title || "قيمة تربوية"}
                </span>
              </div>
              {s.executed ? (
                <Badge variant="default" className="gap-1">
                  <CheckCircle2 className="w-3 h-3" /> منفذ
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1">
                  <Circle className="w-3 h-3" /> لم ينفذ
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="w-3 h-3" />
              {formatDateSmart(s.session_date)}
            </div>

            {mode === "lesson" && (
              <>
                {s.homework && (
                  <p className="text-xs">
                    <span className="font-medium">الواجب: </span>
                    <span className="text-muted-foreground">{s.homework}</span>
                  </p>
                )}
                {s.execution_notes && (
                  <p className="text-xs">
                    <span className="font-medium">ملاحظات التنفيذ: </span>
                    <span className="text-muted-foreground">{s.execution_notes}</span>
                  </p>
                )}
              </>
            )}

            {mode === "values" && s.educational_program_details && (
              <p className="text-xs text-muted-foreground leading-relaxed">{s.educational_program_details}</p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
};

export default TalqeenStudentDailyLog;
