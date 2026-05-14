import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import GuardianLayout from "@/components/GuardianLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { CalendarOff, Plus } from "lucide-react";
import { formatDateHijriOnly } from "@/lib/hijri";

const GuardianExcuses = () => {
  const navigate = useNavigate();
  const [guardian, setGuardian] = useState<any>(null);
  const [children, setChildren] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [studentId, setStudentId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);

  const load = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate("/guardian-auth"); return; }
    const { data: gp } = await supabase.from("guardian_profiles").select("*").eq("id", session.user.id).maybeSingle();
    if (!gp) { navigate("/guardian-auth"); return; }
    setGuardian(gp);

    const { data: links } = await supabase.from("guardian_students").select("student_id").eq("guardian_id", session.user.id);
    if (links?.length) {
      const ids = links.map(l => l.student_id);
      const { data: kids } = await supabase.from("students").select("id, full_name").in("id", ids);
      setChildren(kids || []);
      if (kids?.length === 1) setStudentId(kids[0].id);
    }

    const { data: reqs } = await supabase
      .from("student_excuse_requests" as any)
      .select("*, students(full_name)")
      .eq("guardian_id", session.user.id)
      .order("created_at", { ascending: false });
    setRequests(reqs || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async () => {
    if (!studentId || !dateFrom || !dateTo || !reason.trim()) {
      toast.error("الرجاء تعبئة جميع الحقول"); return;
    }
    if (dateTo < dateFrom) { toast.error("تاريخ النهاية قبل البداية"); return; }
    setSending(true);
    const { error } = await supabase.from("student_excuse_requests" as any).insert({
      guardian_id: guardian.id, student_id: studentId,
      date_from: dateFrom, date_to: dateTo, reason: reason.trim(),
    });
    setSending(false);
    if (error) { toast.error(error.message); return; }
    toast.success("تم إرسال طلب الاستئذان");
    setShowForm(false);
    setDateFrom(""); setDateTo(""); setReason("");
    load();
  };

  const statusBadge = (s: string) => {
    if (s === "approved") return <Badge className="bg-success/15 text-success">معتمد</Badge>;
    if (s === "rejected") return <Badge variant="destructive">مرفوض</Badge>;
    return <Badge className="bg-warning/15 text-warning">قيد المراجعة</Badge>;
  };

  return (
    <GuardianLayout guardianName={guardian?.full_name}>
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">الاستئذان المسبق</h1>
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus className="w-4 h-4 ml-1" />
            طلب جديد
          </Button>
        </div>

        {showForm && (
          <Card>
            <CardHeader><CardTitle className="text-base">طلب استئذان جديد</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>الطالب</Label>
                <Select value={studentId} onValueChange={setStudentId}>
                  <SelectTrigger><SelectValue placeholder="اختر الطالب" /></SelectTrigger>
                  <SelectContent>
                    {children.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>من تاريخ</Label>
                  <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                </div>
                <div>
                  <Label>إلى تاريخ</Label>
                  <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                </div>
              </div>
              <div>
                <Label>السبب</Label>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="سبب الاستئذان..." />
              </div>
              <Button onClick={handleSubmit} disabled={sending} className="w-full">
                {sending ? "جارٍ الإرسال..." : "إرسال الطلب"}
              </Button>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : requests.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <CalendarOff className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">لا توجد طلبات استئذان</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {requests.map((r) => (
              <Card key={r.id}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <p className="font-semibold text-sm">{r.students?.full_name}</p>
                    {statusBadge(r.status)}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {formatDateHijriOnly(r.date_from)} → {formatDateHijriOnly(r.date_to)}
                  </p>
                  <p className="text-sm mt-2">{r.reason}</p>
                  {r.review_note && (
                    <p className="text-xs text-muted-foreground mt-2 bg-muted p-2 rounded">
                      ملاحظة الإدارة: {r.review_note}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </GuardianLayout>
  );
};

export default GuardianExcuses;
