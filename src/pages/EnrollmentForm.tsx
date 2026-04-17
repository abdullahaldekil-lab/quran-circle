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

const calcAgeFromHijri = (hijriDate: string | null, gregorianDate: string | null): string => {
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
      const hijriYear = parseInt(match[1]);
      const approxGregorianYear = Math.round(hijriYear * 0.97 + 622);
      const age = new Date().getFullYear() - approxGregorianYear;
      return age > 0 ? `${age} سنة (تقريبي)` : "";
    }
  }
  return "";
};

export default function EnrollmentForm() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const [student, setStudent] = useState<StudentData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!studentId) return;
    supabase
      .from("students")
      .select("*")
      .eq("id", studentId)
      .single()
      .then(({ data, error }) => {
        if (error) { toast.error("تعذّر جلب بيانات الطالب"); return; }
        setStudent(data as StudentData);
        setLoading(false);
      });
  }, [studentId]);

  const save = useCallback(async (field: string, value: any) => {
    if (!studentId) return;
    const { error } = await (supabase.from("students") as any)
      .update({ [field]: value })
      .eq("id", studentId);
    if (error) toast.error(`خطأ في حفظ ${field}`);
  }, [studentId]);

  const handleChange = (field: string, value: any) => {
    setStudent(prev => prev ? { ...prev, [field]: value } : prev);
    save(field, value);
  };

  const handleBlur = (field: string, value: any) => {
    save(field, value);
  };

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

  const age = calcAgeFromHijri(student.birth_date_hijri, student.birth_date_gregorian);

  return (
    <div dir="rtl" className="max-w-4xl mx-auto p-4 space-y-6 print:p-2">
      {/* Action buttons */}
      <div className="flex items-center gap-3 print:hidden">
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

      {/* Section 1: Student info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg bg-muted px-3 py-1 rounded">خاص بالطالب</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>اسم الطالب الرباعي</Label>
            <Input
              value={student.full_name || ""}
              onChange={e => setStudent(p => p ? { ...p, full_name: e.target.value } : p)}
              onBlur={e => handleBlur("full_name", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>رقم السجل المدني</Label>
            <Input
              value={student.national_id || ""}
              onChange={e => setStudent(p => p ? { ...p, national_id: e.target.value } : p)}
              onBlur={e => handleBlur("national_id", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>تاريخ الميلاد (هجري)</Label>
            <Input
              value={student.birth_date_hijri || ""}
              onChange={e => setStudent(p => p ? { ...p, birth_date_hijri: e.target.value } : p)}
              onBlur={e => handleBlur("birth_date_hijri", e.target.value)}
              placeholder="مثال: 15/06/1415 هـ"
            />
          </div>
          <div className="space-y-1">
            <Label>العمر</Label>
            <Input value={age} readOnly className="bg-muted" />
          </div>
          <div className="space-y-1">
            <Label>الجنسية</Label>
            <Input
              value={student.nationality || ""}
              onChange={e => setStudent(p => p ? { ...p, nationality: e.target.value } : p)}
              onBlur={e => handleBlur("nationality", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>الصف</Label>
            <Input
              value={student.grade || ""}
              onChange={e => setStudent(p => p ? { ...p, grade: e.target.value } : p)}
              onBlur={e => handleBlur("grade", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>مقدار الحفظ</Label>
            <Input
              value={student.memorization_amount || ""}
              onChange={e => setStudent(p => p ? { ...p, memorization_amount: e.target.value } : p)}
              onBlur={e => handleBlur("memorization_amount", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>اسم المدرسة</Label>
            <Input
              value={student.school_name || ""}
              onChange={e => setStudent(p => p ? { ...p, school_name: e.target.value } : p)}
              onBlur={e => handleBlur("school_name", e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Social data */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg bg-muted px-3 py-1 rounded">البيانات الاجتماعية للطالب</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>هل الأب على قيد الحياة؟</Label>
              <RadioGroup
                value={student.father_alive === false ? "no" : "yes"}
                onValueChange={v => handleChange("father_alive", v === "yes")}
                className="flex gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="yes" id="father-yes" />
                  <Label htmlFor="father-yes">نعم</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="no" id="father-no" />
                  <Label htmlFor="father-no">لا</Label>
                </div>
              </RadioGroup>
            </div>
            <div className="space-y-2">
              <Label>هل الأم على قيد الحياة؟</Label>
              <RadioGroup
                value={student.mother_alive === false ? "no" : "yes"}
                onValueChange={v => handleChange("mother_alive", v === "yes")}
                className="flex gap-4"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="yes" id="mother-yes" />
                  <Label htmlFor="mother-yes">نعم</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="no" id="mother-no" />
                  <Label htmlFor="mother-no">لا</Label>
                </div>
              </RadioGroup>
            </div>
          </div>

          <div className="space-y-2">
            <Label>مع من يسكن الطالب؟</Label>
            <RadioGroup
              value={student.lives_with || "الوالدين"}
              onValueChange={v => handleChange("lives_with", v)}
              className="flex flex-wrap gap-4"
            >
              {["الوالدين", "الأب", "الأم", "غيرهما"].map(opt => (
                <div key={opt} className="flex items-center gap-2">
                  <RadioGroupItem value={opt} id={`lives-${opt}`} />
                  <Label htmlFor={`lives-${opt}`}>{opt}</Label>
                </div>
              ))}
            </RadioGroup>
            {student.lives_with === "غيرهما" && (
              <Input
                className="mt-2"
                placeholder="يرجى التحديد..."
                value={student.lives_with_other || ""}
                onChange={e => setStudent(p => p ? { ...p, lives_with_other: e.target.value } : p)}
                onBlur={e => handleBlur("lives_with_other", e.target.value)}
              />
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>موقع السكن</Label>
              <Input
                value={student.residence_location || ""}
                onChange={e => setStudent(p => p ? { ...p, residence_location: e.target.value } : p)}
                onBlur={e => handleBlur("residence_location", e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>مع من يحضر للمجمع؟</Label>
              <Input
                value={student.accompanied_by || ""}
                onChange={e => setStudent(p => p ? { ...p, accompanied_by: e.target.value } : p)}
                onBlur={e => handleBlur("accompanied_by", e.target.value)}
              />
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
            {[
              { field: "has_diabetes", label: "السكري" },
              { field: "has_hearing_impairment", label: "ضعف السمع" },
              { field: "has_asthma", label: "الربو" },
              { field: "has_epilepsy", label: "نوبات الصرع" },
              { field: "has_vision_impairment", label: "ضعف البصر" },
              { field: "has_anemia", label: "فقر الدم" },
              { field: "has_hypertension", label: "ارتفاع ضغط الدم" },
              { field: "has_chest_sensitivity", label: "حساسية الصدر" },
              { field: "has_frequent_urination", label: "كثرة التبول" },
            ].map(({ field, label }) => (
              <div key={field} className="flex items-center gap-2 p-2 border rounded">
                <Checkbox
                  id={field}
                  checked={!!student[field]}
                  onCheckedChange={checked => handleChange(field, !!checked)}
                />
                <Label htmlFor={field} className="cursor-pointer text-sm">{label}</Label>
              </div>
            ))}
          </div>
          <div className="space-y-1">
            <Label>أي أمراض أخرى أو حالات صحية يلزم العناية بها</Label>
            <Textarea
              value={student.other_health_conditions || ""}
              onChange={e => setStudent(p => p ? { ...p, other_health_conditions: e.target.value } : p)}
              onBlur={e => handleBlur("other_health_conditions", e.target.value)}
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      {/* Section 4: Guardian info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg bg-muted px-3 py-1 rounded">خاص بولي الأمر</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>اسم ولي الأمر الرباعي</Label>
            <Input
              value={student.guardian_name || ""}
              onChange={e => setStudent(p => p ? { ...p, guardian_name: e.target.value } : p)}
              onBlur={e => handleBlur("guardian_name", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>رقم السجل المدني لولي الأمر</Label>
            <Input
              value={student.guardian_national_id || ""}
              onChange={e => setStudent(p => p ? { ...p, guardian_national_id: e.target.value } : p)}
              onBlur={e => handleBlur("guardian_national_id", e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>صلة القرابة بالطالب</Label>
            <Input
              value={student.guardian_relation || ""}
              onChange={e => setStudent(p => p ? { ...p, guardian_relation: e.target.value } : p)}
              onBlur={e => handleBlur("guardian_relation", e.target.value)}
              placeholder="مثال: الأب"
            />
          </div>
          <div className="space-y-1">
            <Label>عمل ولي الأمر</Label>
            <Input
              value={student.guardian_work || ""}
              onChange={e => setStudent(p => p ? { ...p, guardian_work: e.target.value } : p)}
              onBlur={e => handleBlur("guardian_work", e.target.value)}
            />
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
              <Input
                value={student.guardian_phone || ""}
                onChange={e => setStudent(p => p ? { ...p, guardian_phone: e.target.value } : p)}
                onBlur={e => handleBlur("guardian_phone", e.target.value)}
                type="tel"
                dir="ltr"
              />
            </div>
            <div className="space-y-1">
              <Label>جوال الطالب</Label>
              <Input
                value={student.student_phone || ""}
                onChange={e => setStudent(p => p ? { ...p, student_phone: e.target.value } : p)}
                onBlur={e => handleBlur("student_phone", e.target.value)}
                type="tel"
                dir="ltr"
              />
            </div>
            <div className="space-y-1">
              <Label>جوال آخر للتواصل</Label>
              <Input
                value={student.guardian_phone_alt || ""}
                onChange={e => setStudent(p => p ? { ...p, guardian_phone_alt: e.target.value } : p)}
                onBlur={e => handleBlur("guardian_phone_alt", e.target.value)}
                type="tel"
                dir="ltr"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>هل سبق التسجيل في حلقة؟</Label>
            <RadioGroup
              value={student.previously_enrolled ? "yes" : "no"}
              onValueChange={v => handleChange("previously_enrolled", v === "yes")}
              className="flex gap-4"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="yes" id="prev-yes" />
                <Label htmlFor="prev-yes">نعم</Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="no" id="prev-no" />
                <Label htmlFor="prev-no">لا</Label>
              </div>
            </RadioGroup>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
