import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, Printer } from "lucide-react";

type StudentData = Record<string, any>;

const calcAge = (hijriDate: string | null, gregorianDate: string | null): string => {
  if (gregorianDate) {
    const birth = new Date(gregorianDate);
    const today = new Date();
    const age = today.getFullYear() - birth.getFullYear() -
      (today < new Date(today.getFullYear(), birth.getMonth(), birth.getDate()) ? 1 : 0);
    return age > 0 ? `${age} سنة` : "";
  }
  if (hijriDate) {
    const match = hijriDate.match(/(\d{4})/);
    if (match) {
      const approxGregorianYear = Math.round(parseInt(match[1]) * 0.97 + 622);
      const age = new Date().getFullYear() - approxGregorianYear;
      return age > 0 ? `${age} سنة` : "";
    }
  }
  return "";
};

/** Render 10 individual digit boxes for national ID */
const IdBoxes = ({ value }: { value: string | null }) => {
  const digits = Array.from({ length: 10 }, (_, i) => (value || "")[i] || "");
  return (
    <div style={{ display: "flex", flexDirection: "row-reverse", gap: 2 }}>
      {digits.map((d, i) => (
        <div key={i} style={{
          border: "1px solid #000", width: 18, height: 20,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 11, fontFamily: "Arial",
        }}>{d}</div>
      ))}
    </div>
  );
};

/** Radio circle indicator for print */
const R = ({ checked }: { checked: boolean }) => (
  <span style={{ fontSize: 13, lineHeight: 1 }}>{checked ? "●" : "○"}</span>
);

const healthFields = [
  { field: "has_diabetes",          label: "السكري" },
  { field: "has_hearing_impairment",label: "ضعف السمع" },
  { field: "has_asthma",            label: "الربو" },
  { field: "has_epilepsy",          label: "نوبات الصرع" },
  { field: "has_vision_impairment", label: "ضعف البصر" },
  { field: "has_anemia",            label: "فقر الدم" },
  { field: "has_hypertension",      label: "ارتفاع ضغط الدم" },
  { field: "has_chest_sensitivity", label: "حساسية الصدر" },
  { field: "has_frequent_urination",label: "كثرة التبول" },
];

export default function EnrollmentForm() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const [student, setStudent] = useState<StudentData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!studentId) return;
    supabase.from("students").select("*").eq("id", studentId).single()
      .then(({ data, error }) => {
        if (error) { toast.error("تعذّر جلب بيانات الطالب"); return; }
        setStudent(data as StudentData);
        setLoading(false);
      });
  }, [studentId]);

  const save = useCallback(async (field: string, value: any) => {
    if (!studentId) return;
    const { error } = await (supabase.from("students") as any)
      .update({ [field]: value }).eq("id", studentId);
    if (error) toast.error(`خطأ في حفظ ${field}`);
  }, [studentId]);

  const handleChange = (field: string, value: any) => {
    setStudent(prev => prev ? { ...prev, [field]: value } : prev);
    save(field, value);
  };

  const handleBlur = (field: string, value: any) => save(field, value);

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-muted-foreground">جارٍ التحميل...</p>
    </div>
  );
  if (!student) return (
    <div className="flex items-center justify-center min-h-screen">
      <p className="text-destructive">لم يتم العثور على الطالب</p>
    </div>
  );

  const age = calcAge(student.birth_date_hijri, student.birth_date_gregorian);
  const livesWithVal = student.lives_with || "الوالدين";

  const td: React.CSSProperties = { border: "1px solid #000", padding: "4px 6px", fontSize: 11, fontFamily: "Arial" };
  const th: React.CSSProperties = { ...td, backgroundColor: "#e8e8e8", fontWeight: "bold", textAlign: "center" };
  const sectionTitle: React.CSSProperties = {
    backgroundColor: "#d0d0d0", fontWeight: "bold", textAlign: "center",
    padding: "4px 6px", border: "1px solid #000", fontSize: 12,
  };

  return (
    <>
      {/* ── Print CSS ── */}
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          @page { size: A4 portrait; margin: 12mm; }
          body { font-family: 'Arial', sans-serif; font-size: 11px; direction: rtl; }
          table { border-collapse: collapse; width: 100%; }
          td, th { border: 1px solid #000; padding: 4px 6px; }
        }
        .print-only { display: none; }
      `}</style>

      {/* ══════════════════════════════════════════
          PRINT LAYOUT — hidden on screen
      ══════════════════════════════════════════ */}
      <div className="print-only" dir="rtl" style={{ fontFamily: "Arial, sans-serif", fontSize: 11, direction: "rtl" }}>

        {/* Header */}
        <table style={{ borderCollapse: "collapse", width: "100%", border: "none", marginBottom: 6 }}>
          <tbody>
            <tr>
              {/* Right: association name */}
              <td style={{ border: "none", textAlign: "right", width: "33%", fontSize: 10, verticalAlign: "top" }}>
                <div style={{ fontWeight: "bold", fontSize: 11 }}>الجمعية الخيرية لتحفيظ القرآن الكريم ببريدة</div>
                <div>مجمع حلق حويلان</div>
                <div>ترخيص رقم (٦ / م ٢٦)</div>
              </td>
              {/* Center: Basmala */}
              <td style={{ border: "none", textAlign: "center", width: "34%", fontSize: 14, fontWeight: "bold", verticalAlign: "middle" }}>
                بسم الله الرحمن الرحيم
              </td>
              {/* Left: logo placeholder */}
              <td style={{ border: "none", textAlign: "left", width: "33%", verticalAlign: "top" }}>
                <div style={{ fontWeight: "bold", fontSize: 12 }}>مجمع حلق حويلان</div>
              </td>
            </tr>
          </tbody>
        </table>

        <div style={{ textAlign: "center", fontWeight: "bold", fontSize: 14, marginBottom: 8, borderTop: "2px solid #000", paddingTop: 6 }}>
          استمارة تسجيل طالب بالمجمع
        </div>

        {/* ── Section 1: Student ── */}
        <table style={{ borderCollapse: "collapse", width: "100%", marginBottom: 6 }}>
          <tbody>
            <tr><td colSpan={6} style={sectionTitle}>خاص بالطالب</td></tr>
            <tr>
              <td style={td} colSpan={3}>
                <div style={{ marginBottom: 2 }}>رقم السجل المدني</div>
                <IdBoxes value={student.national_id} />
              </td>
              <td style={td} colSpan={3}>
                <span style={{ fontWeight: "bold" }}>اسم الطالب رباعي: </span>
                {student.full_name || ""}
              </td>
            </tr>
            <tr>
              <td style={td} colSpan={2}>
                <span style={{ fontWeight: "bold" }}>الجنسية: </span>{student.nationality || ""}
              </td>
              <td style={td} colSpan={2}>
                <span style={{ fontWeight: "bold" }}>العمر: </span>{age}
              </td>
              <td style={td} colSpan={2}>
                <span style={{ fontWeight: "bold" }}>تاريخ الميلاد: </span>
                {student.birth_date_hijri || "  /  /  ١٤  هـ"}
              </td>
            </tr>
            <tr>
              <td style={td} colSpan={2}>
                <span style={{ fontWeight: "bold" }}>اسم المدرسة: </span>{student.school_name || ""}
              </td>
              <td style={td} colSpan={2}>
                <span style={{ fontWeight: "bold" }}>مقدار الحفظ: </span>{student.memorization_amount || ""}
              </td>
              <td style={td} colSpan={2}>
                <span style={{ fontWeight: "bold" }}>الصف: </span>{student.grade || ""}
              </td>
            </tr>
          </tbody>
        </table>

        {/* ── Section 2: Social ── */}
        <table style={{ borderCollapse: "collapse", width: "100%", marginBottom: 6 }}>
          <tbody>
            <tr><td colSpan={4} style={sectionTitle}>البيانات الاجتماعية للطالب</td></tr>
            <tr>
              <td style={td}>
                <span style={{ fontWeight: "bold" }}>غيرهما: </span>
                {livesWithVal === "غيرهما" ? (student.lives_with_other || "..........") : ".........."}
              </td>
              <td style={td}>
                <span style={{ fontWeight: "bold" }}>مع من يسكن الطالب: </span>
                <span style={{ marginLeft: 4 }}><R checked={livesWithVal === "الوالدين"} /> الوالدين</span>
                <span style={{ marginLeft: 4, marginRight: 4 }}><R checked={livesWithVal === "الأب"} /> الأب</span>
                <span style={{ marginLeft: 4, marginRight: 4 }}><R checked={livesWithVal === "الأم"} /> الأم</span>
                <span style={{ marginRight: 4 }}><R checked={livesWithVal === "غيرهما"} /> غيرهما</span>
              </td>
              <td style={td}>
                <span style={{ fontWeight: "bold" }}>هل الأم على قيد الحياة: </span>
                <span style={{ marginLeft: 4 }}><R checked={student.mother_alive !== false} /> نعم</span>
                <span style={{ marginRight: 4 }}><R checked={student.mother_alive === false} /> لا</span>
              </td>
              <td style={td}>
                <span style={{ fontWeight: "bold" }}>هل الأب على قيد الحياة: </span>
                <span style={{ marginLeft: 4 }}><R checked={student.father_alive !== false} /> نعم</span>
                <span style={{ marginRight: 4 }}><R checked={student.father_alive === false} /> لا</span>
              </td>
            </tr>
            <tr>
              <td style={td} colSpan={2}>
                <span style={{ fontWeight: "bold" }}>موقع السكن: </span>{student.residence_location || ""}
              </td>
              <td style={td} colSpan={2}>
                <span style={{ fontWeight: "bold" }}>مع من يحضر الطالب للمجمع: </span>{student.accompanied_by || ""}
              </td>
            </tr>
          </tbody>
        </table>

        {/* ── Section 3: Health ── */}
        <table style={{ borderCollapse: "collapse", width: "100%", marginBottom: 6 }}>
          <tbody>
            <tr><td colSpan={9} style={sectionTitle}>الحالة الصحية للطالب</td></tr>
            <tr>
              <td colSpan={9} style={{ ...td, backgroundColor: "#f5f5f5" }}>
                هل يعاني الطالب من الأمراض المزمنة التالية:
              </td>
            </tr>
            <tr>
              <td style={th}>المرض</td><td style={th}>نعم</td><td style={th}>لا</td>
              <td style={th}>المرض</td><td style={th}>نعم</td><td style={th}>لا</td>
              <td style={th}>المرض</td><td style={th}>نعم</td><td style={th}>لا</td>
            </tr>
            {[0, 1, 2].map(row => (
              <tr key={row}>
                {[0, 1, 2].map(col => {
                  const item = healthFields[row * 3 + col];
                  const val = !!student[item.field];
                  return (
                    <>
                      <td key={item.field + "l"} style={td}>{item.label}</td>
                      <td key={item.field + "y"} style={{ ...td, textAlign: "center" }}>{val ? "●" : ""}</td>
                      <td key={item.field + "n"} style={{ ...td, textAlign: "center" }}>{!val ? "●" : ""}</td>
                    </>
                  );
                })}
              </tr>
            ))}
            <tr>
              <td colSpan={9} style={td}>
                <span style={{ fontWeight: "bold" }}>أي أمراض أخرى أو حالات صحية يلزم العناية بها: </span>
                {student.other_health_conditions || ""}
              </td>
            </tr>
          </tbody>
        </table>

        {/* ── Section 4: Guardian ── */}
        <table style={{ borderCollapse: "collapse", width: "100%", marginBottom: 6 }}>
          <tbody>
            <tr><td colSpan={4} style={sectionTitle}>خاص بولي الأمر</td></tr>
            <tr>
              <td style={td} colSpan={2}>
                <div style={{ marginBottom: 2 }}>رقم السجل المدني</div>
                <IdBoxes value={student.guardian_national_id} />
              </td>
              <td style={td} colSpan={2}>
                <span style={{ fontWeight: "bold" }}>اسم ولي الأمر رباعي: </span>
                {student.guardian_name || ""}
              </td>
            </tr>
            <tr>
              <td style={td} colSpan={2}>
                <span style={{ fontWeight: "bold" }}>عمل ولي الأمر: </span>{student.guardian_work || ""}
              </td>
              <td style={td} colSpan={2}>
                <span style={{ fontWeight: "bold" }}>صلة القرابة بالطالب: </span>{student.guardian_relation || ""}
              </td>
            </tr>
          </tbody>
        </table>

        {/* ── Section 5: Contact ── */}
        <table style={{ borderCollapse: "collapse", width: "100%", marginBottom: 6 }}>
          <tbody>
            <tr><td colSpan={4} style={sectionTitle}>بيانات الاتصال</td></tr>
            <tr>
              <td style={td} colSpan={2}>
                <span style={{ fontWeight: "bold" }}>جوال الطالب: </span>
                <span dir="ltr">{student.student_phone || ""}</span>
              </td>
              <td style={td} colSpan={2}>
                <span style={{ fontWeight: "bold" }}>جوال ولي الأمر: </span>
                <span dir="ltr">{student.guardian_phone || ""}</span>
              </td>
            </tr>
            <tr>
              <td style={td} colSpan={2}>
                <span style={{ fontWeight: "bold" }}>هل سبق التسجيل في حلقة: </span>
                <span style={{ marginLeft: 6 }}><R checked={!student.previously_enrolled} /> لا</span>
                <span style={{ marginRight: 6 }}><R checked={!!student.previously_enrolled} /> نعم</span>
              </td>
              <td style={td} colSpan={2}>
                <span style={{ fontWeight: "bold" }}>جوال آخر للتواصل: </span>
                <span dir="ltr">{student.guardian_phone_alt || ""}</span>
              </td>
            </tr>
          </tbody>
        </table>

        {/* ── Pledge ── */}
        <div style={{ border: "1px solid #000", padding: "6px 8px", marginBottom: 8, fontSize: 10, lineHeight: 1.8 }}>
          أتعهد أنا ولي أمر الطالب / <span style={{ borderBottom: "1px dotted #000", display: "inline-block", minWidth: 200 }}>{student.guardian_name || ""}</span> بأن أكون متابعاً لسير دراسة ابني بالمجمع، ومتعاوناً مع إدارة المجمع في كل ما يخص ابني دراسياً وسلوكياً وانتظاماً، وأتعهد بأن جميع البيانات المدخلة بالنموذج صحيحة وأتحمل المسؤولية الكاملة إذا كانت خلاف ذلك.
        </div>

        {/* ── Footer ── */}
        <table style={{ borderCollapse: "collapse", width: "100%", border: "none" }}>
          <tbody>
            <tr>
              <td style={{ border: "none", width: "40%", paddingLeft: 8 }}>
                <span style={{ fontWeight: "bold" }}>اسم ولي الأمر / </span>
                <span>{student.guardian_name || ""}</span>
              </td>
              <td style={{ border: "none", width: "30%", textAlign: "center" }}>
                <span style={{ fontWeight: "bold" }}>التوقيع / </span>
                ................................
              </td>
              <td style={{ border: "none", width: "30%", textAlign: "left" }}>
                <span style={{ fontWeight: "bold" }}>تاريخ التسجيل: </span>
                {student.registration_date_hijri || "    /    /  ١٤  هـ"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ══════════════════════════════════════════
          SCREEN FORM — hidden on print
      ══════════════════════════════════════════ */}
      <div className="no-print" dir="rtl">
        <div className="max-w-4xl mx-auto p-4 space-y-6">

          {/* Action buttons */}
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => navigate(`/students/${studentId}`)}>
              <ArrowRight className="h-4 w-4 ml-1" />
              العودة للطالب
            </Button>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="h-4 w-4 ml-1" />
              طباعة الاستمارة
            </Button>
          </div>

          <h1 className="text-2xl font-bold text-center">استمارة تسجيل طالب بالمجمع</h1>

          {/* Section 1: Student */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg bg-muted px-3 py-1 rounded">خاص بالطالب</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>اسم الطالب الرباعي</Label>
                <Input value={student.full_name || ""}
                  onChange={e => setStudent(p => p ? { ...p, full_name: e.target.value } : p)}
                  onBlur={e => handleBlur("full_name", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>رقم السجل المدني</Label>
                <Input value={student.national_id || ""}
                  onChange={e => setStudent(p => p ? { ...p, national_id: e.target.value } : p)}
                  onBlur={e => handleBlur("national_id", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>تاريخ الميلاد (هجري)</Label>
                <Input value={student.birth_date_hijri || ""}
                  onChange={e => setStudent(p => p ? { ...p, birth_date_hijri: e.target.value } : p)}
                  onBlur={e => handleBlur("birth_date_hijri", e.target.value)}
                  placeholder="مثال: 15/06/1415 هـ" />
              </div>
              <div className="space-y-1">
                <Label>العمر</Label>
                <Input value={age} readOnly className="bg-muted" />
              </div>
              <div className="space-y-1">
                <Label>الجنسية</Label>
                <Input value={student.nationality || ""}
                  onChange={e => setStudent(p => p ? { ...p, nationality: e.target.value } : p)}
                  onBlur={e => handleBlur("nationality", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>الصف</Label>
                <Input value={student.grade || ""}
                  onChange={e => setStudent(p => p ? { ...p, grade: e.target.value } : p)}
                  onBlur={e => handleBlur("grade", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>مقدار الحفظ</Label>
                <Input value={student.memorization_amount || ""}
                  onChange={e => setStudent(p => p ? { ...p, memorization_amount: e.target.value } : p)}
                  onBlur={e => handleBlur("memorization_amount", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>اسم المدرسة</Label>
                <Input value={student.school_name || ""}
                  onChange={e => setStudent(p => p ? { ...p, school_name: e.target.value } : p)}
                  onBlur={e => handleBlur("school_name", e.target.value)} />
              </div>
            </CardContent>
          </Card>

          {/* Section 2: Social */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg bg-muted px-3 py-1 rounded">البيانات الاجتماعية للطالب</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>هل الأب على قيد الحياة؟</Label>
                  <RadioGroup value={student.father_alive === false ? "no" : "yes"}
                    onValueChange={v => handleChange("father_alive", v === "yes")}
                    className="flex gap-4">
                    <div className="flex items-center gap-2"><RadioGroupItem value="yes" id="fa-y" /><Label htmlFor="fa-y">نعم</Label></div>
                    <div className="flex items-center gap-2"><RadioGroupItem value="no" id="fa-n" /><Label htmlFor="fa-n">لا</Label></div>
                  </RadioGroup>
                </div>
                <div className="space-y-2">
                  <Label>هل الأم على قيد الحياة؟</Label>
                  <RadioGroup value={student.mother_alive === false ? "no" : "yes"}
                    onValueChange={v => handleChange("mother_alive", v === "yes")}
                    className="flex gap-4">
                    <div className="flex items-center gap-2"><RadioGroupItem value="yes" id="ma-y" /><Label htmlFor="ma-y">نعم</Label></div>
                    <div className="flex items-center gap-2"><RadioGroupItem value="no" id="ma-n" /><Label htmlFor="ma-n">لا</Label></div>
                  </RadioGroup>
                </div>
              </div>
              <div className="space-y-2">
                <Label>مع من يسكن الطالب؟</Label>
                <RadioGroup value={livesWithVal} onValueChange={v => handleChange("lives_with", v)} className="flex flex-wrap gap-4">
                  {["الوالدين", "الأب", "الأم", "غيرهما"].map(opt => (
                    <div key={opt} className="flex items-center gap-2">
                      <RadioGroupItem value={opt} id={`lw-${opt}`} />
                      <Label htmlFor={`lw-${opt}`}>{opt}</Label>
                    </div>
                  ))}
                </RadioGroup>
                {livesWithVal === "غيرهما" && (
                  <Input className="mt-2" placeholder="يرجى التحديد..."
                    value={student.lives_with_other || ""}
                    onChange={e => setStudent(p => p ? { ...p, lives_with_other: e.target.value } : p)}
                    onBlur={e => handleBlur("lives_with_other", e.target.value)} />
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>موقع السكن</Label>
                  <Input value={student.residence_location || ""}
                    onChange={e => setStudent(p => p ? { ...p, residence_location: e.target.value } : p)}
                    onBlur={e => handleBlur("residence_location", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label>مع من يحضر للمجمع؟</Label>
                  <Input value={student.accompanied_by || ""}
                    onChange={e => setStudent(p => p ? { ...p, accompanied_by: e.target.value } : p)}
                    onBlur={e => handleBlur("accompanied_by", e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Section 3: Health */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg bg-muted px-3 py-1 rounded">الحالة الصحية للطالب</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">هل يعاني الطالب من الأمراض المزمنة التالية:</p>
              <div className="grid grid-cols-3 gap-3">
                {healthFields.map(({ field, label }) => (
                  <div key={field} className="flex items-center gap-2 p-2 border rounded">
                    <Checkbox id={field} checked={!!student[field]}
                      onCheckedChange={checked => handleChange(field, !!checked)} />
                    <Label htmlFor={field} className="cursor-pointer text-sm">{label}</Label>
                  </div>
                ))}
              </div>
              <div className="space-y-1">
                <Label>أي أمراض أخرى أو حالات صحية يلزم العناية بها</Label>
                <Textarea value={student.other_health_conditions || ""}
                  onChange={e => setStudent(p => p ? { ...p, other_health_conditions: e.target.value } : p)}
                  onBlur={e => handleBlur("other_health_conditions", e.target.value)}
                  rows={2} />
              </div>
            </CardContent>
          </Card>

          {/* Section 4: Guardian */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg bg-muted px-3 py-1 rounded">خاص بولي الأمر</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>اسم ولي الأمر الرباعي</Label>
                <Input value={student.guardian_name || ""}
                  onChange={e => setStudent(p => p ? { ...p, guardian_name: e.target.value } : p)}
                  onBlur={e => handleBlur("guardian_name", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>رقم السجل المدني لولي الأمر</Label>
                <Input value={student.guardian_national_id || ""}
                  onChange={e => setStudent(p => p ? { ...p, guardian_national_id: e.target.value } : p)}
                  onBlur={e => handleBlur("guardian_national_id", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>صلة القرابة بالطالب</Label>
                <Input value={student.guardian_relation || ""}
                  onChange={e => setStudent(p => p ? { ...p, guardian_relation: e.target.value } : p)}
                  onBlur={e => handleBlur("guardian_relation", e.target.value)}
                  placeholder="مثال: الأب" />
              </div>
              <div className="space-y-1">
                <Label>عمل ولي الأمر</Label>
                <Input value={student.guardian_work || ""}
                  onChange={e => setStudent(p => p ? { ...p, guardian_work: e.target.value } : p)}
                  onBlur={e => handleBlur("guardian_work", e.target.value)} />
              </div>
            </CardContent>
          </Card>

          {/* Section 5: Contact */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg bg-muted px-3 py-1 rounded">بيانات الاتصال</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label>جوال ولي الأمر</Label>
                  <Input value={student.guardian_phone || ""}
                    onChange={e => setStudent(p => p ? { ...p, guardian_phone: e.target.value } : p)}
                    onBlur={e => handleBlur("guardian_phone", e.target.value)}
                    type="tel" dir="ltr" />
                </div>
                <div className="space-y-1">
                  <Label>جوال الطالب</Label>
                  <Input value={student.student_phone || ""}
                    onChange={e => setStudent(p => p ? { ...p, student_phone: e.target.value } : p)}
                    onBlur={e => handleBlur("student_phone", e.target.value)}
                    type="tel" dir="ltr" />
                </div>
                <div className="space-y-1">
                  <Label>جوال آخر للتواصل</Label>
                  <Input value={student.guardian_phone_alt || ""}
                    onChange={e => setStudent(p => p ? { ...p, guardian_phone_alt: e.target.value } : p)}
                    onBlur={e => handleBlur("guardian_phone_alt", e.target.value)}
                    type="tel" dir="ltr" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>هل سبق التسجيل في حلقة؟</Label>
                <RadioGroup value={student.previously_enrolled ? "yes" : "no"}
                  onValueChange={v => handleChange("previously_enrolled", v === "yes")}
                  className="flex gap-4">
                  <div className="flex items-center gap-2"><RadioGroupItem value="yes" id="pe-y" /><Label htmlFor="pe-y">نعم</Label></div>
                  <div className="flex items-center gap-2"><RadioGroupItem value="no" id="pe-n" /><Label htmlFor="pe-n">لا</Label></div>
                </RadioGroup>
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </>
  );
}
