import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { CalendarOff } from "lucide-react";
import { formatDateHijriOnly } from "@/lib/hijri";

const GuardianExcusesAdmin = () => {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("pending");
  const [notes, setNotes] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("student_excuse_requests" as any)
      .select("*, students(full_name)")
      .order("created_at", { ascending: false });
    if (data?.length) {
      const ids = Array.from(new Set(data.map((r: any) => r.guardian_id)));
      const { data: gps } = await supabase.from("guardian_profiles").select("id, full_name, phone").in("id", ids);
      const map = new Map((gps || []).map((g: any) => [g.id, g]));
      data.forEach((r: any) => { r.guardian = map.get(r.guardian_id); });
    }
    setRequests(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const decide = async (id: string, status: "approved" | "rejected") => {
    const { data: { session } } = await supabase.auth.getSession();
    const { error } = await supabase.from("student_excuse_requests" as any).update({
      status, reviewed_by: session?.user.id, reviewed_at: new Date().toISOString(), review_note: notes[id] || null,
    }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(status === "approved" ? "تم الاعتماد وتسجيل الاستئذان في الحضور" : "تم الرفض");
    load();
  };

  const filtered = requests.filter(r => filter === "all" || r.status === filter);

  return (
    <div className="space-y-4" dir="rtl">
      <h1 className="text-2xl font-bold">طلبات الاستئذان المسبق</h1>

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList>
          <TabsTrigger value="pending">قيد المراجعة</TabsTrigger>
          <TabsTrigger value="approved">معتمدة</TabsTrigger>
          <TabsTrigger value="rejected">مرفوضة</TabsTrigger>
          <TabsTrigger value="all">الكل</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <p className="text-muted-foreground text-center py-10">جارٍ التحميل...</p>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-8 text-center">
          <CalendarOff className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">لا توجد طلبات</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((r: any) => (
            <Card key={r.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold">{r.students?.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      من: {r.guardian?.full_name} {r.guardian?.phone && <span dir="ltr">({r.guardian.phone})</span>}
                    </p>
                  </div>
                  <Badge variant={r.status === "approved" ? "default" : r.status === "rejected" ? "destructive" : "outline"}>
                    {r.status === "approved" ? "معتمد" : r.status === "rejected" ? "مرفوض" : "قيد المراجعة"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  المدة: {formatDateHijriOnly(r.date_from)} → {formatDateHijriOnly(r.date_to)}
                </p>
                <p className="text-sm bg-muted/50 p-3 rounded">{r.reason}</p>
                {r.review_note && (
                  <p className="text-xs text-muted-foreground">ملاحظة: {r.review_note}</p>
                )}
                {r.status === "pending" && (
                  <div className="space-y-2 pt-2 border-t">
                    <Input
                      placeholder="ملاحظة (اختياري)"
                      value={notes[r.id] || ""}
                      onChange={(e) => setNotes(p => ({ ...p, [r.id]: e.target.value }))}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => decide(r.id, "approved")}>اعتماد</Button>
                      <Button size="sm" variant="destructive" onClick={() => decide(r.id, "rejected")}>رفض</Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default GuardianExcusesAdmin;
