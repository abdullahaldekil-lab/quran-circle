import { useEffect, useState } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, ShieldX, Search, ArrowLeft } from "lucide-react";
import { formatDateSmart } from "@/lib/hijri";

export default function VerifyCertificate() {
  const { number } = useParams();
  const [params] = useSearchParams();
  const initial = number || params.get("n") || "";
  const [code, setCode] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [searched, setSearched] = useState(false);

  const verify = async (n: string) => {
    if (!n.trim()) return;
    setLoading(true);
    setSearched(true);
    const { data } = await supabase
      .from("talqeen_student_tests")
      .select(`
        certificate_number, certificate_issued_at, test_date, score, max_score, status,
        attendance_score, attendance_max, homework_score, homework_max,
        students:student_id (full_name, halaqat:halaqa_id (name)),
        talqeen_curricula:curriculum_id (name)
      `)
      .eq("certificate_number", n.trim())
      .eq("test_type", "promotion")
      .eq("status", "passed")
      .maybeSingle();
    setResult(data);
    setLoading(false);
  };

  useEffect(() => {
    if (initial) verify(initial);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 py-8 px-4" dir="rtl">
      <Helmet>
        <title>التحقق من صحة الشهادة — مجمع حويلان</title>
        <meta name="description" content="تحقق من صحة شهادات نهاية المستوى الصادرة من مجمع حويلان لتحفيظ القرآن الكريم باستخدام رقم الشهادة." />
        <link rel="canonical" href="https://quran-circle.enter.com.sa/verify-certificate" />
        <meta property="og:title" content="التحقق من صحة الشهادة — مجمع حويلان" />
        <meta property="og:description" content="تحقق من صحة شهادات نهاية المستوى الصادرة من مجمع حويلان لتحفيظ القرآن الكريم." />
        <meta property="og:url" content="https://quran-circle.enter.com.sa/verify-certificate" />
      </Helmet>
      <main className="max-w-2xl mx-auto">
        <Link to="/dashboard" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary mb-4">
          <ArrowLeft className="w-4 h-4 ml-1" /> العودة
        </Link>
        <h1 className="sr-only">التحقق من صحة الشهادة</h1>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="w-6 h-6 text-green-700" />
              التحقق من شهادة نهاية المستوى
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="أدخل رقم الشهادة (مثال: TLQ-2026-0001)"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && verify(code)}
              />
              <Button onClick={() => verify(code)} disabled={loading}>
                <Search className="w-4 h-4 ml-1" /> تحقق
              </Button>
            </div>

            {loading && <p className="text-center text-muted-foreground py-6">جاري التحقق...</p>}

            {!loading && searched && !result && (
              <div className="text-center py-8 border-2 border-dashed border-red-300 rounded-lg bg-red-50">
                <ShieldX className="w-12 h-12 text-red-600 mx-auto mb-2" />
                <p className="font-bold text-red-700">شهادة غير صالحة أو غير موجودة</p>
                <p className="text-sm text-red-600 mt-1">تأكد من رقم الشهادة المُدخل</p>
              </div>
            )}

            {!loading && result && (
              <div className="border-2 border-green-500 rounded-lg p-6 bg-white space-y-3">
                <div className="flex items-center justify-between">
                  <Badge className="bg-green-600 text-white">
                    <ShieldCheck className="w-4 h-4 ml-1" /> شهادة موثّقة
                  </Badge>
                  <span className="text-xs text-muted-foreground font-mono">{result.certificate_number}</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <Field label="اسم الطالب" value={result.students?.full_name} />
                  <Field label="الحلقة" value={result.students?.halaqat?.name} />
                  <Field label="المنهج / المستوى" value={result.talqeen_curricula?.name} />
                  <Field label="تاريخ الاختبار" value={formatDateSmart(result.test_date)} />
                  <Field label="تاريخ الإصدار" value={result.certificate_issued_at ? formatDateSmart(result.certificate_issued_at) : "—"} />
                  <Field label="النتيجة" value={`${result.score} / ${result.max_score} — ناجح`} />
                  {result.attendance_score !== null && (
                    <Field label="درجة الحضور" value={`${result.attendance_score} / ${result.attendance_max}`} />
                  )}
                  {result.homework_score !== null && (
                    <Field label="درجة الواجب" value={`${result.homework_score} / ${result.homework_max}`} />
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value || "—"}</p>
    </div>
  );
}
