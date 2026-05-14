import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import GuardianLayout from "@/components/GuardianLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Clock, CheckCircle2, XCircle } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type LinkRequest = Database["public"]["Tables"]["guardian_link_requests"]["Row"];

const GuardianLinkRequest = () => {
  const [requests, setRequests] = useState<LinkRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [nationalId, setNationalId] = useState("");
  const [nameHint, setNameHint] = useState("");
  const [relationship, setRelationship] = useState("أب");
  const [guardianName, setGuardianName] = useState("");

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    const { data: gp, error: e1 } = await supabase
      .from("guardian_profiles")
      .select("full_name")
      .eq("id", session.user.id)
      .maybeSingle();
    if (e1) toast.error("خطأ في تحميل بيانات الحساب");
    setGuardianName(gp?.full_name || "");
    const { data, error: e2 } = await supabase
      .from("guardian_link_requests")
      .select("*")
      .eq("guardian_id", session.user.id)
      .order("created_at", { ascending: false });
    if (e2) toast.error("خطأ في تحميل الطلبات");
    setRequests((data as LinkRequest[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{10}$/.test(nationalId)) {
      toast.error("رقم الهوية يجب أن يكون 10 أرقام");
      return;
    }
    setSubmitting(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("يجب تسجيل الدخول أولاً");
      setSubmitting(false);
      return;
    }
    const { error } = await supabase.from("guardian_link_requests").insert({
      guardian_id: session.user.id,
      student_national_id: nationalId.trim(),
      student_name_hint: nameHint.trim() || null,
      relationship,
    });
    setSubmitting(false);
    if (error) {
      // duplicate pending request
      if (error.code === "23505") {
        toast.error("يوجد طلب معلق بالفعل لهذا الرقم");
      } else {
        toast.error(error.message);
      }
      return;
    }
    toast.success("تم إرسال الطلب وسيتم مراجعته");
    setNationalId(""); setNameHint("");
    load();
  };

  const statusBadge = (s: string) => {
    if (s === "approved") return <Badge className="bg-green-600"><CheckCircle2 className="w-3 h-3 ml-1" />مقبول</Badge>;
    if (s === "rejected") return <Badge variant="destructive"><XCircle className="w-3 h-3 ml-1" />مرفوض</Badge>;
    return <Badge variant="secondary"><Clock className="w-3 h-3 ml-1" />قيد المراجعة</Badge>;
  };

  return (
    <GuardianLayout guardianName={guardianName}>
      <div className="space-y-4 animate-fade-in">
        <Card>
          <CardHeader><CardTitle className="text-base">إضافة ابن برقم الهوية</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-3">
              <div>
                <Label>رقم هوية الطالب</Label>
                <Input value={nationalId} onChange={(e) => setNationalId(e.target.value)} placeholder="10 أرقام" dir="ltr" maxLength={10} />
              </div>
              <div>
                <Label>اسم الطالب (اختياري)</Label>
                <Input value={nameHint} onChange={(e) => setNameHint(e.target.value)} placeholder="للتحقق فقط" />
              </div>
              <div>
                <Label>صلة القرابة</Label>
                <Select value={relationship} onValueChange={setRelationship}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="أب">أب</SelectItem>
                    <SelectItem value="أم">أم</SelectItem>
                    <SelectItem value="جد">جد</SelectItem>
                    <SelectItem value="أخ">أخ</SelectItem>
                    <SelectItem value="عم">عم/خال</SelectItem>
                    <SelectItem value="آخر">آخر</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={submitting} className="w-full">
                <Plus className="w-4 h-4 ml-2" />
                {submitting ? "جارٍ الإرسال..." : "إرسال طلب الربط"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">طلباتي السابقة</CardTitle></CardHeader>
          <CardContent>
            {loading ? <p className="text-sm text-muted-foreground">جارٍ التحميل...</p>
              : requests.length === 0 ? <p className="text-sm text-muted-foreground">لا توجد طلبات</p>
              : <div className="space-y-2">
                  {requests.map((r) => (
                    <div key={r.id} className="border rounded-lg p-3 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{r.student_name_hint || r.student_national_id}</p>
                        <p className="text-xs text-muted-foreground" dir="ltr">{r.student_national_id}</p>
                        {r.rejection_reason && <p className="text-xs text-destructive mt-1">سبب الرفض: {r.rejection_reason}</p>}
                      </div>
                      {statusBadge(r.status)}
                    </div>
                  ))}
                </div>}
          </CardContent>
        </Card>
      </div>
    </GuardianLayout>
  );
};

export default GuardianLinkRequest;
