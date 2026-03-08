import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatHijriArabic } from "@/lib/hijri";
import { History, Bot, User } from "lucide-react";

interface LogEntry {
  id: string;
  old_status: string | null;
  new_status: string;
  reason_category: string;
  reason_detail: string | null;
  transfer_destination: string | null;
  changed_by_name: string | null;
  is_system: boolean;
  created_at: string;
}

const STATUS_LABELS: Record<string, string> = {
  active: "نشط",
  inactive: "غير نشط",
  inactive_transferred: "منتقل",
  inactive_excluded: "مستبعد",
  inactive_absence: "مستبعد – غياب",
  inactive_other: "أخرى",
  warned: "منذَر",
  suspended: "موقوف",
};

const REASON_LABELS: Record<string, string> = {
  transfer: "انتقال",
  exclusion: "استبعاد",
  absence: "غياب تراكمي",
  manual: "تعديل يدوي",
  reactivation: "إعادة تفعيل",
  other: "أخرى",
  warning: "إنذار غياب",
};

const StudentStatusLog = ({ studentId }: { studentId: string }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("student_status_log" as any)
        .select("*")
        .eq("student_id", studentId)
        .order("created_at", { ascending: false })
        .limit(50);
      setLogs((data as any) || []);
      setLoading(false);
    };
    fetch();
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
          <History className="w-5 h-5 text-primary" />
          سجل الحالات
        </CardTitle>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">لا يوجد سجل حالات</p>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <div key={log.id} className="flex gap-3 py-3 border-b last:border-0">
                <div className="mt-0.5">
                  {log.is_system ? (
                    <div className="w-7 h-7 rounded-full bg-warning/10 flex items-center justify-center">
                      <Bot className="w-4 h-4 text-warning" />
                    </div>
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="w-4 h-4 text-primary" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {log.old_status && (
                      <>
                        <Badge variant="outline" className="text-xs">{STATUS_LABELS[log.old_status] || log.old_status}</Badge>
                        <span className="text-xs text-muted-foreground">←</span>
                      </>
                    )}
                    <Badge variant="secondary" className="text-xs">{STATUS_LABELS[log.new_status] || log.new_status}</Badge>
                    <Badge variant="outline" className="text-xs bg-muted/50">{REASON_LABELS[log.reason_category] || log.reason_category}</Badge>
                  </div>
                  {log.reason_detail && (
                    <p className="text-xs text-muted-foreground mt-1">{log.reason_detail}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span>{formatHijriArabic(log.created_at)}</span>
                    <span>•</span>
                    <span>{log.is_system ? "النظام" : log.changed_by_name || "مدير"}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default StudentStatusLog;
