import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const anonClient = createClient(SUPABASE_URL, SUPABASE_KEY);

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "قيد المراجعة", color: "bg-yellow-100 text-yellow-800" },
  approved: { label: "مقبول", color: "bg-green-100 text-green-800" },
  rejected: { label: "مرفوض", color: "bg-red-100 text-red-800" },
  waiting_list: { label: "قائمة انتظار", color: "bg-orange-100 text-orange-800" },
};

interface Props {
  initialPhone?: string;
}

const EnrollmentStatusCheck = ({ initialPhone = "" }: Props) => {
  const [checkPhone, setCheckPhone] = useState(initialPhone);
  const [statusResults, setStatusResults] = useState<any[]>([]);
  const [checking, setChecking] = useState(false);

  const handleCheckStatus = async () => {
    if (!checkPhone.trim()) { toast.error("أدخل رقم الهاتف"); return; }
    setChecking(true);
    const { data, error } = await anonClient.rpc("check_enrollment_status", {
      phone_number: checkPhone.replace(/\s/g, ""),
    });
    setStatusResults(data || []);
    setChecking(false);
    if (error) { console.error(error); toast.error("حدث خطأ"); return; }
    if (!data || data.length === 0) toast.info("لم يتم العثور على طلبات لهذا الرقم");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">متابعة حالة الطلب</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            value={checkPhone}
            onChange={(e) => setCheckPhone(e.target.value)}
            placeholder="أدخل رقم الجوال"
            dir="ltr"
            className="text-right flex-1"
          />
          <Button onClick={handleCheckStatus} disabled={checking}>
            {checking ? "..." : "بحث"}
          </Button>
        </div>

        {statusResults.length > 0 && (
          <div className="space-y-2">
            {statusResults.map((r: any, i: number) => {
              const st = STATUS_LABELS[r.status] || STATUS_LABELS.pending;
              return (
                <div key={i} className="border rounded-lg p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{r.student_full_name}</span>
                    <Badge className={st.color}>{st.label}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString("ar-SA")}
                  </p>
                  {r.rejection_reason && (
                    <p className="text-xs text-destructive">السبب: {r.rejection_reason}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default EnrollmentStatusCheck;
