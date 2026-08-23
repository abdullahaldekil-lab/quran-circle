import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, RefreshCw, Bot, Hand, AlertTriangle, Plus, Pencil, Link2 } from "lucide-react";
import { PERMISSIONS_REGISTRY } from "@/lib/permissionsRegistry";
import { formatDateTimeSmart } from "@/lib/hijri";

interface SyncLogEntry {
  id: string;
  performed_by: string | null;
  performed_by_name: string | null;
  trigger_source: string;
  added_permissions: string[] | null;
  updated_permissions: string[] | null;
  links_created: number;
  errors: string[] | null;
  created_at: string;
}

const arName = (name: string) =>
  PERMISSIONS_REGISTRY.find((p) => p.name === name)?.name_ar || name;

const fmtTime = (iso: string) => {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  try {
    return formatDateTimeSmart(d);
  } catch {
    return d.toLocaleString("ar-SA");
  }
};

export const PermissionsSyncLog = () => {
  const [logs, setLogs] = useState<SyncLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("permissions_sync_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(20);
    setLogs(
      ((data as any[]) || []).map((r) => ({
        ...r,
        added_permissions: Array.isArray(r.added_permissions) ? r.added_permissions : [],
        updated_permissions: Array.isArray(r.updated_permissions) ? r.updated_permissions : [],
        errors: Array.isArray(r.errors) ? r.errors : [],
      })) as SyncLogEntry[]
    );
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5" /> سجل تدقيق مزامنة الصلاحيات
          </CardTitle>
          <CardDescription>
            متى نُفِّذت المزامنة، ومن نفّذها، وأي صلاحيات أُضيفت أو حُدِّثت (آخر ٢٠ عملية)
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading} aria-label="تحديث السجل">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          تحديث
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">جاري التحميل...</p>
        ) : logs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            لا توجد عمليات مزامنة مسجّلة بعد
          </p>
        ) : (
          <ScrollArea className="h-[520px] pl-2">
            <div className="space-y-3">
              {logs.map((log) => (
                <div key={log.id} className="rounded-lg border p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={log.trigger_source === "auto" ? "secondary" : "default"} className="gap-1">
                        {log.trigger_source === "auto" ? (
                          <>
                            <Bot className="w-3 h-3" /> تلقائية
                          </>
                        ) : (
                          <>
                            <Hand className="w-3 h-3" /> يدوية
                          </>
                        )}
                      </Badge>
                      <span className="text-sm font-medium">
                        {log.performed_by_name || "مستخدم غير معروف"}
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">{fmtTime(log.created_at)}</span>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="outline" className="gap-1">
                      <Plus className="w-3 h-3" /> مضافة: {log.added_permissions?.length || 0}
                    </Badge>
                    <Badge variant="outline" className="gap-1">
                      <Pencil className="w-3 h-3" /> محدَّثة: {log.updated_permissions?.length || 0}
                    </Badge>
                    <Badge variant="outline" className="gap-1">
                      <Link2 className="w-3 h-3" /> روابط بالأدوار: {log.links_created}
                    </Badge>
                  </div>

                  {(log.added_permissions?.length || 0) > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">الصلاحيات المضافة:</p>
                      <div className="flex flex-wrap gap-1">
                        {log.added_permissions!.map((n) => (
                          <Badge key={n} variant="secondary" className="text-[11px]">
                            {arName(n)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {(log.updated_permissions?.length || 0) > 0 && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">الصلاحيات المحدَّثة:</p>
                      <div className="flex flex-wrap gap-1">
                        {log.updated_permissions!.map((n) => (
                          <Badge key={n} variant="outline" className="text-[11px]">
                            {arName(n)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {(log.errors?.length || 0) > 0 && (
                    <div className="rounded-md bg-destructive/10 p-2 space-y-1">
                      {log.errors!.map((e, i) => (
                        <p key={i} className="text-xs text-destructive flex items-start gap-1">
                          <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" /> {e}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};

export default PermissionsSyncLog;
