import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CheckCircle2, XCircle, UserCheck, Link2 } from "lucide-react";

const GuardianApprovals = () => {
  const [guardians, setGuardians] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectKind, setRejectKind] = useState<"guardian" | "request">("guardian");
  const [reason, setReason] = useState("");

  const load = async () => {
    const [{ data: gs }, { data: rs }] = await Promise.all([
      supabase.from("guardian_profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("guardian_link_requests").select("*, guardian_profiles(full_name, phone)").order("created_at", { ascending: false }),
    ]);
    setGuardians(gs || []);
    setRequests(rs || []);
  };
  useEffect(() => { load(); }, []);

  const approveGuardian = async (id: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    const { error } = await supabase.from("guardian_profiles").update({
      approval_status: "approved", approved_by: session?.user.id, approved_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("تم اعتماد الحساب");
    load();
  };

  const rejectGuardian = async () => {
    if (!rejectId) return;
    const { error } = await supabase.from("guardian_profiles").update({ approval_status: "rejected" }).eq("id", rejectId);
    if (error) return toast.error(error.message);
    toast.success("تم الرفض");
    setRejectId(null); setReason(""); load();
  };

  const approveRequest = async (id: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    const { error } = await supabase.from("guardian_link_requests").update({
      status: "approved", reviewed_by: session?.user.id,
    }).eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("تم ربط الطالب");
    load();
  };

  const rejectRequest = async () => {
    if (!rejectId) return;
    const { data: { session } } = await supabase.auth.getSession();
    const { error } = await supabase.from("guardian_link_requests").update({
      status: "rejected", rejection_reason: reason || "غير مطابق", reviewed_by: session?.user.id,
    }).eq("id", rejectId);
    if (error) return toast.error(error.message);
    toast.success("تم رفض الطلب");
    setRejectId(null); setReason(""); load();
  };

  const pendingGuardians = guardians.filter((g) => g.approval_status === "pending");
  const pendingRequests = requests.filter((r) => r.status === "pending");

  const sBadge = (s: string) =>
    s === "approved" ? <Badge className="bg-green-600">مقبول</Badge>
    : s === "rejected" ? <Badge variant="destructive">مرفوض</Badge>
    : <Badge variant="secondary">قيد المراجعة</Badge>;

  return (
    <AppLayout>
      <div className="space-y-4 animate-fade-in">
        <h1 className="text-2xl font-bold">موافقات أولياء الأمور</h1>

        <Tabs defaultValue="guardians">
          <TabsList>
            <TabsTrigger value="guardians">
              <UserCheck className="w-4 h-4 ml-2" />
              الحسابات ({pendingGuardians.length})
            </TabsTrigger>
            <TabsTrigger value="requests">
              <Link2 className="w-4 h-4 ml-2" />
              طلبات الربط ({pendingRequests.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="guardians">
            <Card>
              <CardHeader><CardTitle className="text-base">قائمة الحسابات</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {guardians.map((g) => (
                  <div key={g.id} className="border rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium">{g.full_name}</p>
                      <p className="text-xs text-muted-foreground" dir="ltr">{g.phone || "—"}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {sBadge(g.approval_status)}
                      {g.approval_status === "pending" && (
                        <>
                          <Button size="sm" onClick={() => approveGuardian(g.id)}>
                            <CheckCircle2 className="w-4 h-4 ml-1" />اعتماد
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => { setRejectKind("guardian"); setRejectId(g.id); }}>
                            <XCircle className="w-4 h-4 ml-1" />رفض
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                {guardians.length === 0 && <p className="text-sm text-muted-foreground">لا توجد حسابات</p>}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="requests">
            <Card>
              <CardHeader><CardTitle className="text-base">طلبات ربط الطلاب</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {requests.map((r) => (
                  <div key={r.id} className="border rounded-lg p-3 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{r.guardian_profiles?.full_name || "—"}</p>
                      <p className="text-xs text-muted-foreground">
                        هوية الطالب: <span dir="ltr">{r.student_national_id}</span>
                        {r.student_name_hint && ` • ${r.student_name_hint}`}
                      </p>
                      {r.rejection_reason && <p className="text-xs text-destructive">سبب الرفض: {r.rejection_reason}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      {sBadge(r.status)}
                      {r.status === "pending" && (
                        <>
                          <Button size="sm" onClick={() => approveRequest(r.id)}>
                            <CheckCircle2 className="w-4 h-4 ml-1" />اعتماد
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => { setRejectKind("request"); setRejectId(r.id); }}>
                            <XCircle className="w-4 h-4 ml-1" />رفض
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                {requests.length === 0 && <p className="text-sm text-muted-foreground">لا توجد طلبات</p>}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={!!rejectId} onOpenChange={(o) => { if (!o) { setRejectId(null); setReason(""); } }}>
          <DialogContent>
            <DialogHeader><DialogTitle>سبب الرفض</DialogTitle></DialogHeader>
            <Label>السبب</Label>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="اكتب سبب الرفض" />
            <DialogFooter>
              <Button variant="outline" onClick={() => setRejectId(null)}>إلغاء</Button>
              <Button variant="destructive" onClick={rejectKind === "guardian" ? rejectGuardian : rejectRequest}>
                تأكيد الرفض
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
};

export default GuardianApprovals;
