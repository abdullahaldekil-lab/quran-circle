import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatHijriArabic } from "@/lib/hijri";
import { ClipboardList, Sparkles, PencilLine, ArrowLeft } from "lucide-react";

interface LogEntry {
  id: string;
  plan_id: string | null;
  action: string;
  field_name: string | null;
  old_value: string | null;
  new_value: string | null;
  changed_by_name: string | null;
  created_at: string;
}

const FIELD_LABELS: Record<string, string> = {
  plan: "الخطة",
  plan_type: "نوع المنهج",
  status: "حالة الخطة",
  academic_year: "العام الدراسي",
  total_target_pages: "إجمالي الأوجه المستهدفة",
  daily_memorization_pages: "الحفظ اليومي (وجه)",
  daily_review_pages: "المراجعة اليومية (وجه)",
  daily_linking_pages: "الربط اليومي (وجه)",
  start_date: "تاريخ البداية",
  end_date: "تاريخ النهاية",
  halaqa_id: "الحلقة",
};

const VALUE_LABELS: Record<string, string> = {
  silver: "فضي",
  gold: "ذهبي",
  custom: "مخصص",
  active: "نشطة",
  suspended: "موقوفة",
  completed: "مكتملة",
  cancelled: "ملغاة",
};

const pretty = (v: string | null) => {
  if (!v) return "—";
  return VALUE_LABELS[v] || v;
};

/** سجل ربط خطة الطالب وتغييرات المنهج: من قام بالتغيير ومتى. */
const StudentPlanChangeLog = ({ studentId }: { studentId: string }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    supabase
      .from("student_plan_change_log" as any)
      .select("*")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(100)
      .then(({ data }) => {
        if (!alive) return;
        setLogs((data as any) || []);
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [studentId]);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-primary" />
          سجل خطة الحفظ وتغييرات المنهج
        </CardTitle>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            لا توجد تغييرات مسجلة على خطة الطالب حتى الآن
          </p>
        ) : (
          <div className="space-y-1">
            {logs.map((log) => {
              const isCreate = log.action === "created";
              return (
                <div key={log.id} className="flex gap-3 py-3 border-b last:border-0">
                  <div className="mt-0.5">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center ${
                        isCreate ? "bg-success/10" : "bg-primary/10"
                      }`}
                    >
                      {isCreate ? (
                        <Sparkles className="w-4 h-4 text-success" />
                      ) : (
                        <PencilLine className="w-4 h-4 text-primary" />
                      )}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant={isCreate ? "secondary" : "outline"} className="text-xs">
                        {isCreate ? "ربط خطة جديدة" : "تعديل"}
                      </Badge>
                      <span className="text-sm font-medium">
                        {FIELD_LABELS[log.field_name || ""] || log.field_name}
                      </span>
                    </div>
                    {isCreate ? (
                      <p className="text-xs text-muted-foreground mt-1">{pretty(log.new_value)}</p>
                    ) : (
                      <div className="flex items-center gap-2 mt-1 text-xs flex-wrap">
                        <span className="text-muted-foreground line-through">{pretty(log.old_value)}</span>
                        <ArrowLeft className="w-3 h-3 text-muted-foreground" />
                        <span className="font-semibold">{pretty(log.new_value)}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                      <span>{formatHijriArabic(log.created_at)}</span>
                      <span>•</span>
                      <span>{log.changed_by_name || "غير معروف"}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default StudentPlanChangeLog;
