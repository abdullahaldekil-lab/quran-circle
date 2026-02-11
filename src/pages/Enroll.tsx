import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CheckCircle2, Send, BookOpen, Search } from "lucide-react";
import huwaylanLogo from "@/assets/huwaylan-logo.jpeg";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const anonClient = createClient(SUPABASE_URL, SUPABASE_KEY);

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "قيد المراجعة", color: "bg-yellow-100 text-yellow-800" },
  approved: { label: "مقبول", color: "bg-green-100 text-green-800" },
  rejected: { label: "مرفوض", color: "bg-red-100 text-red-800" },
  waiting_list: { label: "قائمة انتظار", color: "bg-orange-100 text-orange-800" },
};

const Enroll = () => {
  const [halaqat, setHalaqat] = useState<{ id: string; name: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [view, setView] = useState<"form" | "status">("form");

  // Status check
  const [checkPhone, setCheckPhone] = useState("");
  const [statusResults, setStatusResults] = useState<any[]>([]);
  const [checking, setChecking] = useState(false);

  const [form, setForm] = useState({
    guardian_full_name: "",
    guardian_phone: "",
    student_full_name: "",
    student_birth_year: "",
    requested_halaqa_id: "",
    preferred_time: "",
    notes: "",
  });

  useEffect(() => {
    anonClient.from("halaqat").select("id, name").eq("active", true).order("name").then(({ data }) => {
      setHalaqat(data || []);
    });
  }, []);

  const handleSubmit = async () => {
    if (!form.guardian_full_name.trim() || !form.guardian_phone.trim() || !form.student_full_name.trim()) {
      toast.error("الاسم الكامل لولي الأمر والهاتف واسم الطالب مطلوبة");
      return;
    }

    // Simple phone format validation
    const phoneClean = form.guardian_phone.replace(/\s/g, "");
    if (phoneClean.length < 9) {
      toast.error("رقم الهاتف غير صحيح");
      return;
    }

    // Rate limiting: check if this phone submitted in last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await anonClient
      .from("enrollment_requests")
      .select("id", { count: "exact", head: true })
      .eq("guardian_phone", phoneClean)
      .gte("created_at", oneHourAgo);

    if (count && count >= 3) {
      toast.error("تم تجاوز الحد المسموح. يرجى المحاولة لاحقاً");
      return;
    }

    setSubmitting(true);
    const { error } = await anonClient.from("enrollment_requests").insert({
      guardian_full_name: form.guardian_full_name.trim(),
      guardian_phone: phoneClean,
      student_full_name: form.student_full_name.trim(),
      student_birth_year: form.student_birth_year ? parseInt(form.student_birth_year) : null,
      requested_halaqa_id: form.requested_halaqa_id || null,
      preferred_time: form.preferred_time.trim() || null,
      notes: form.notes.trim() || null,
    });
    setSubmitting(false);

    if (error) {
      toast.error("حدث خطأ. يرجى المحاولة مجدداً");
      console.error(error);
      return;
    }

    setSubmitted(true);
  };

  const handleCheckStatus = async () => {
    if (!checkPhone.trim()) { toast.error("أدخل رقم الهاتف"); return; }
    setChecking(true);
    const { data } = await anonClient
      .from("enrollment_requests")
      .select("student_full_name, status, rejection_reason, created_at")
      .eq("guardian_phone", checkPhone.replace(/\s/g, ""))
      .order("created_at", { ascending: false });
    setStatusResults(data || []);
    setChecking(false);
    if (!data || data.length === 0) toast.info("لم يتم العثور على طلبات لهذا الرقم");
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background flex items-center justify-center p-4" dir="rtl">
        <Card className="max-w-md w-full text-center">
          <CardContent className="p-8 space-y-4">
            <CheckCircle2 className="w-16 h-16 mx-auto text-green-600" />
            <h2 className="text-xl font-bold">تم إرسال الطلب بنجاح</h2>
            <p className="text-muted-foreground text-sm">
              سيتم مراجعة طلبكم من قبل إدارة المجمع والتواصل معكم قريباً إن شاء الله.
            </p>
            <p className="text-muted-foreground text-xs">
              يمكنكم متابعة حالة الطلب عبر إدخال رقم الهاتف في صفحة التسجيل.
            </p>
            <Button variant="outline" onClick={() => { setSubmitted(false); setView("status"); setCheckPhone(form.guardian_phone); }}>
              <Search className="w-4 h-4 ml-2" />متابعة حالة الطلب
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/5 to-background" dir="rtl">
      <div className="max-w-md mx-auto p-4 py-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <img src={huwaylanLogo} alt="مجمع حويلان" className="w-16 h-16 rounded-2xl mx-auto object-contain" />
          <h1 className="text-xl font-bold">مجمع حويلان لتحفيظ القرآن</h1>
          <p className="text-muted-foreground text-sm">نموذج طلب التحاق طالب جديد</p>
        </div>

        {/* Toggle */}
        <div className="flex gap-2">
          <Button variant={view === "form" ? "default" : "outline"} className="flex-1" onClick={() => setView("form")}>
            <Send className="w-4 h-4 ml-2" />تقديم طلب
          </Button>
          <Button variant={view === "status" ? "default" : "outline"} className="flex-1" onClick={() => setView("status")}>
            <Search className="w-4 h-4 ml-2" />متابعة الطلب
          </Button>
        </div>

        {view === "form" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">بيانات الطلب</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1">
                <Label>اسم ولي الأمر الكامل *</Label>
                <Input value={form.guardian_full_name} onChange={(e) => setForm({ ...form, guardian_full_name: e.target.value })} placeholder="مثال: أحمد محمد العلي" />
              </div>
              <div className="space-y-1">
                <Label>رقم الجوال *</Label>
                <Input value={form.guardian_phone} onChange={(e) => setForm({ ...form, guardian_phone: e.target.value })} placeholder="05xxxxxxxx" dir="ltr" className="text-right" type="tel" />
              </div>
              <div className="space-y-1">
                <Label>اسم الطالب الكامل *</Label>
                <Input value={form.student_full_name} onChange={(e) => setForm({ ...form, student_full_name: e.target.value })} placeholder="مثال: محمد أحمد العلي" />
              </div>
              <div className="space-y-1">
                <Label>سنة الميلاد (اختياري)</Label>
                <Input value={form.student_birth_year} onChange={(e) => setForm({ ...form, student_birth_year: e.target.value })} placeholder="مثال: 2015" type="number" dir="ltr" className="text-right" />
              </div>
              <div className="space-y-1">
                <Label>الحلقة المطلوبة (اختياري)</Label>
                <Select value={form.requested_halaqa_id} onValueChange={(v) => setForm({ ...form, requested_halaqa_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر الحلقة" />
                  </SelectTrigger>
                  <SelectContent>
                    {halaqat.map((h) => (
                      <SelectItem key={h.id} value={h.id}>
                        <span className="flex items-center gap-2">
                          <BookOpen className="w-3 h-3" />
                          {h.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>الوقت المفضل (اختياري)</Label>
                <Input value={form.preferred_time} onChange={(e) => setForm({ ...form, preferred_time: e.target.value })} placeholder="مثال: بعد العصر" />
              </div>
              <div className="space-y-1">
                <Label>ملاحظات (اختياري)</Label>
                <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} placeholder="أي ملاحظات إضافية..." />
              </div>
              <Button onClick={handleSubmit} disabled={submitting} className="w-full" size="lg">
                {submitting ? "جارٍ الإرسال..." : "إرسال الطلب"}
              </Button>
            </CardContent>
          </Card>
        )}

        {view === "status" && (
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
                  {statusResults.map((r, i) => {
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
        )}

        <p className="text-center text-xs text-muted-foreground">
          مجمع حويلان لتحفيظ القرآن الكريم
        </p>
      </div>
    </div>
  );
};

export default Enroll;
