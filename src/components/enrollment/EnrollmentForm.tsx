import { useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { User, Heart, GraduationCap, FileText } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const anonClient = createClient(SUPABASE_URL, SUPABASE_KEY);

export interface EnrollmentFormData {
  student_full_name: string;
  student_nationality: string;
  student_birth_date_hijri: string;
  student_id_number: string;
  student_phone: string;
  student_no_phone: string;
  student_school: string;
  student_grade: string;
  student_age: string;
  living_with: string;
  living_with_other: string;
  brought_by: string;
  parents_status: string;
  guardian_full_name: string;
  guardian_relationship: string;
  guardian_id_number: string;
  guardian_phone: string;
  guardian_alt_phone: string;
  guardian_job: string;
  guardian_address: string;
  has_chronic_diseases: string;
  chronic_diseases_details: string;
  has_medications: string;
  medications_details: string;
  has_allergies: string;
  allergies_details: string;
  previous_enrollment: string;
  previous_place: string;
  memorization_amount: string;
  notes: string;
}

const initialFormData: EnrollmentFormData = {
  student_full_name: "",
  student_nationality: "سعودي",
  student_birth_date_hijri: "",
  student_id_number: "",
  student_phone: "",
  student_no_phone: "لا",
  student_school: "",
  student_grade: "",
  student_age: "",
  living_with: "والديه",
  living_with_other: "",
  brought_by: "",
  parents_status: "مستقرة",
  guardian_full_name: "",
  guardian_relationship: "أب",
  guardian_id_number: "",
  guardian_phone: "",
  guardian_alt_phone: "",
  guardian_job: "",
  guardian_address: "",
  has_chronic_diseases: "لا",
  chronic_diseases_details: "",
  has_medications: "لا",
  medications_details: "",
  has_allergies: "لا",
  allergies_details: "",
  previous_enrollment: "لا",
  previous_place: "",
  memorization_amount: "",
  notes: "",
};

const SCHOOL_GRADES = [
  "قبل التعليم",
  "الأول الابتدائي", "الثاني الابتدائي", "الثالث الابتدائي",
  "الرابع الابتدائي", "الخامس الابتدائي", "السادس الابتدائي",
  "الأول المتوسط", "الثاني المتوسط", "الثالث المتوسط",
  "الأول الثانوي", "الثاني الثانوي", "الثالث الثانوي",
  "جامعي", "أخرى",
];

interface Props {
  onSubmitted: (data: EnrollmentFormData) => void;
}

const EnrollmentForm = ({ onSubmitted }: Props) => {
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<EnrollmentFormData>(initialFormData);

  const set = (key: keyof EnrollmentFormData, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    // Required fields validation
    const required: { key: keyof EnrollmentFormData; label: string }[] = [
      { key: "student_full_name", label: "اسم الطالب" },
      { key: "student_nationality", label: "الجنسية" },
      { key: "student_birth_date_hijri", label: "تاريخ الميلاد الهجري" },
      { key: "student_id_number", label: "رقم الهوية" },
      { key: "student_school", label: "المدرسة" },
      { key: "student_grade", label: "المرحلة الدراسية" },
      { key: "student_age", label: "العمر" },
      { key: "brought_by", label: "من يحضر الطالب" },
      { key: "guardian_full_name", label: "اسم ولي الأمر" },
      { key: "guardian_id_number", label: "رقم هوية ولي الأمر" },
      { key: "guardian_phone", label: "رقم جوال ولي الأمر" },
      { key: "guardian_alt_phone", label: "رقم جوال للتواصل (آخر)" },
      { key: "guardian_job", label: "عمل ولي الأمر" },
      { key: "guardian_address", label: "عنوان السكن" },
      { key: "memorization_amount", label: "مقدار الحفظ الحالي" },
    ];

    for (const f of required) {
      if (!String(form[f.key] || "").trim()) {
        toast.error(`الحقل مطلوب: ${f.label}`);
        return;
      }
    }

    if (form.living_with === "أخرى" && !form.living_with_other.trim()) {
      toast.error("يرجى توضيح مع من يعيش الطالب");
      return;
    }

    if (form.student_no_phone === "لا" && !form.student_phone.trim()) {
      toast.error("يرجى إدخال رقم جوال الطالب أو اختيار (لا يوجد)");
      return;
    }

    // ID number validation: exactly 10 digits
    const studentIdClean = form.student_id_number.replace(/\D/g, "");
    if (studentIdClean.length !== 10) {
      toast.error("رقم هوية الطالب يجب أن يكون 10 أرقام");
      return;
    }
    const guardianIdClean = form.guardian_id_number.replace(/\D/g, "");
    if (guardianIdClean.length !== 10) {
      toast.error("رقم هوية ولي الأمر يجب أن يكون 10 أرقام");
      return;
    }

    const normalizePhone = (raw: string): string => {
      let d = raw.replace(/\D/g, "");
      if (d.startsWith("00966")) d = d.slice(5);
      else if (d.startsWith("966")) d = d.slice(3);
      if (d.length === 9 && d.startsWith("5")) d = "0" + d;
      while (d.length > 10 && d.startsWith("0")) d = d.slice(1);
      return d;
    };
    const phoneClean = normalizePhone(form.guardian_phone);
    if (!/^05\d{8}$/.test(phoneClean)) {
      toast.error("رقم الجوال غير صحيح. يجب أن يكون 05XXXXXXXX");
      return;
    }
    const altPhoneClean = normalizePhone(form.guardian_alt_phone);
    if (!/^05\d{8}$/.test(altPhoneClean)) {
      toast.error("رقم جوال التواصل الآخر غير صحيح. يجب أن يكون 05XXXXXXXX");
      return;
    }
    let studentPhoneClean = "";
    if (form.student_no_phone === "لا") {
      studentPhoneClean = normalizePhone(form.student_phone);
      if (!/^05\d{8}$/.test(studentPhoneClean)) {
        toast.error("رقم جوال الطالب غير صحيح. يجب أن يكون 05XXXXXXXX");
        return;
      }
    }

    if (form.has_chronic_diseases === "نعم" && !form.chronic_diseases_details.trim()) {
      toast.error("يرجى توضيح الأمراض المزمنة");
      return;
    }
    if (form.has_medications === "نعم" && !form.medications_details.trim()) {
      toast.error("يرجى توضيح الأدوية المستخدمة");
      return;
    }
    if (form.has_allergies === "نعم" && !form.allergies_details.trim()) {
      toast.error("يرجى توضيح الحساسية");
      return;
    }
    if (form.previous_enrollment === "نعم" && !form.previous_place.trim()) {
      toast.error("يرجى توضيح اسم الحلقة السابقة");
      return;
    }
    if (submitting) return;
    setSubmitting(true);

    const { student_full_name, guardian_full_name, guardian_phone, notes, student_age, student_grade, ...extraFields } = form;

    const { error } = await anonClient.from("enrollment_requests").insert({
      student_full_name: student_full_name.trim(),
      guardian_full_name: guardian_full_name.trim(),
      guardian_phone: phoneClean,
      student_birth_year: null,
      notes: notes.trim() || null,
      form_data: {
        ...extraFields,
        student_id_number: studentIdClean,
        guardian_id_number: guardianIdClean,
        guardian_alt_phone: altPhoneClean,
        student_phone: studentPhoneClean,
        student_age,
        student_grade,
      },
    });

    setSubmitting(false);

    if (error) {
      const msg = error.message || "";
      if (msg.includes("DUPLICATE_ID_NUMBER")) {
        toast.error("تم تقديم طلب مسبقاً بهذا رقم الهوية. لا يمكن إرسال أكثر من طلب واحد لنفس الطالب.");
      } else if (msg.includes("DUPLICATE_STUDENT_REQUEST")) {
        toast.error("يوجد طلب مسجل مسبقاً لهذا الطالب بنفس رقم الجوال.");
      } else if (msg.includes("RATE_LIMIT_EXCEEDED")) {
        toast.error("تم تجاوز الحد المسموح من الطلبات. يرجى المحاولة لاحقاً.");
      } else {
        toast.error("حدث خطأ. يرجى المحاولة مجدداً");
      }
      console.error(error);
      return;
    }

    onSubmitted(form);
  };


  return (
    <div className="space-y-4">
      {/* Student Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="w-4 h-4 text-primary" />
            بيانات الطالب
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label>اسم الطالب رباعي *</Label>
            <Input value={form.student_full_name} onChange={(e) => set("student_full_name", e.target.value)} placeholder="الاسم الأول / الأب / الجد / العائلة" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>الجنسية *</Label>
              <Input value={form.student_nationality} onChange={(e) => set("student_nationality", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>رقم الهوية / الإقامة * (10 أرقام)</Label>
              <Input
                value={form.student_id_number}
                onChange={(e) => set("student_id_number", e.target.value.replace(/\D/g, "").slice(0, 10))}
                dir="ltr"
                className="text-right"
                inputMode="numeric"
                maxLength={10}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>تاريخ الميلاد هجري *</Label>
              <Input value={form.student_birth_date_hijri} onChange={(e) => set("student_birth_date_hijri", e.target.value)} placeholder="مثال: 1437/05/15" dir="ltr" className="text-right" />
            </div>
            <div className="space-y-1">
              <Label>العمر *</Label>
              <Input value={form.student_age} onChange={(e) => set("student_age", e.target.value)} placeholder="مثال: 10 سنوات" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>المرحلة الدراسية *</Label>
              <Select value={form.student_grade} onValueChange={(v) => set("student_grade", v)}>
                <SelectTrigger><SelectValue placeholder="اختر المرحلة" /></SelectTrigger>
                <SelectContent>
                  {SCHOOL_GRADES.map((g) => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>المدرسة *</Label>
              <Input value={form.student_school} onChange={(e) => set("student_school", e.target.value)} />
            </div>
          </div>

          {/* Student Phone */}
          <div className="space-y-2 border-t pt-3">
            <Label>هل لدى الطالب رقم جوال؟ *</Label>
            <RadioGroup value={form.student_no_phone} onValueChange={(v) => set("student_no_phone", v)} className="flex gap-4">
              <div className="flex items-center gap-1.5">
                <RadioGroupItem value="لا" id="stp-yes" />
                <Label htmlFor="stp-yes" className="font-normal cursor-pointer">نعم لديه رقم</Label>
              </div>
              <div className="flex items-center gap-1.5">
                <RadioGroupItem value="نعم" id="stp-no" />
                <Label htmlFor="stp-no" className="font-normal cursor-pointer">لا يوجد</Label>
              </div>
            </RadioGroup>
            {form.student_no_phone === "لا" && (
              <Input
                value={form.student_phone}
                onChange={(e) => set("student_phone", e.target.value)}
                placeholder="05xxxxxxxx"
                dir="ltr"
                className="text-right"
                type="tel"
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Social Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            البيانات الاجتماعية
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label>من يعيش معه الطالب *</Label>
            <RadioGroup value={form.living_with} onValueChange={(v) => set("living_with", v)} className="flex flex-wrap gap-4">
              {["والديه", "الأب", "الأم", "أخرى"].map((opt) => (
                <div key={opt} className="flex items-center gap-1.5">
                  <RadioGroupItem value={opt} id={`living-${opt}`} />
                  <Label htmlFor={`living-${opt}`} className="font-normal cursor-pointer">{opt}</Label>
                </div>
              ))}
            </RadioGroup>
            {form.living_with === "أخرى" && (
              <Input
                value={form.living_with_other}
                onChange={(e) => set("living_with_other", e.target.value)}
                placeholder="يرجى التوضيح..."
                className="mt-2"
              />
            )}
          </div>
          <div className="space-y-1">
            <Label>الحالة الاجتماعية للوالدين *</Label>
            <RadioGroup value={form.parents_status} onValueChange={(v) => set("parents_status", v)} className="flex flex-wrap gap-4">
              {["مستقرة", "منفصلين", "متوفى الأب", "متوفاة الأم", "متوفى الوالدين"].map((opt) => (
                <div key={opt} className="flex items-center gap-1.5">
                  <RadioGroupItem value={opt} id={`parents-${opt}`} />
                  <Label htmlFor={`parents-${opt}`} className="font-normal cursor-pointer">{opt}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>
          <div className="space-y-1">
            <Label>من يحضر الطالب للمجمع *</Label>
            <Input
              value={form.brought_by}
              onChange={(e) => set("brought_by", e.target.value)}
              placeholder="مثال: الأب / الأم / السائق / يأتي بنفسه"
            />
          </div>
        </CardContent>
      </Card>

      {/* Guardian Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="w-4 h-4 text-primary" />
            بيانات ولي الأمر
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label>اسم ولي الأمر *</Label>
            <Input value={form.guardian_full_name} onChange={(e) => set("guardian_full_name", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>صلة القرابة *</Label>
              <Select value={form.guardian_relationship} onValueChange={(v) => set("guardian_relationship", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["أب", "أم", "أخ", "عم", "خال", "جد", "أخرى"].map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>رقم هوية ولي الأمر * (10 أرقام)</Label>
              <Input
                value={form.guardian_id_number}
                onChange={(e) => set("guardian_id_number", e.target.value.replace(/\D/g, "").slice(0, 10))}
                dir="ltr"
                className="text-right"
                inputMode="numeric"
                maxLength={10}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>رقم الجوال *</Label>
              <Input value={form.guardian_phone} onChange={(e) => set("guardian_phone", e.target.value)} placeholder="05xxxxxxxx" dir="ltr" className="text-right" type="tel" />
            </div>
            <div className="space-y-1">
              <Label>رقم جوال للتواصل (آخر) *</Label>
              <Input value={form.guardian_alt_phone} onChange={(e) => set("guardian_alt_phone", e.target.value)} placeholder="05xxxxxxxx" dir="ltr" className="text-right" type="tel" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>عمل ولي الأمر *</Label>
              <Input value={form.guardian_job} onChange={(e) => set("guardian_job", e.target.value)} placeholder="مثال: معلم / موظف / متقاعد" />
            </div>
            <div className="space-y-1">
              <Label>عنوان السكن *</Label>
              <Input value={form.guardian_address} onChange={(e) => set("guardian_address", e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Health */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Heart className="w-4 h-4 text-primary" />
            الحالة الصحية
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { key: "has_chronic_diseases" as const, detail: "chronic_diseases_details" as const, label: "هل يعاني الطالب من أمراض مزمنة؟ *" },
            { key: "has_medications" as const, detail: "medications_details" as const, label: "هل يستخدم أدوية بشكل مستمر؟ *" },
            { key: "has_allergies" as const, detail: "allergies_details" as const, label: "هل يعاني من حساسية؟ *" },
          ].map(({ key, detail, label }) => (
            <div key={key} className="space-y-2">
              <div className="flex items-center gap-4">
                <Label className="flex-1">{label}</Label>
                <RadioGroup value={form[key]} onValueChange={(v) => set(key, v)} className="flex gap-3">
                  <div className="flex items-center gap-1"><RadioGroupItem value="نعم" id={`${key}-yes`} /><Label htmlFor={`${key}-yes`} className="font-normal cursor-pointer">نعم</Label></div>
                  <div className="flex items-center gap-1"><RadioGroupItem value="لا" id={`${key}-no`} /><Label htmlFor={`${key}-no`} className="font-normal cursor-pointer">لا</Label></div>
                </RadioGroup>
              </div>
              {form[key] === "نعم" && (
                <Input value={form[detail]} onChange={(e) => set(detail, e.target.value)} placeholder="يرجى التوضيح..." className="mr-4" />
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Quran Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-primary" />
            المعلومات القرآنية
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <div className="flex items-center gap-4">
              <Label className="flex-1">هل سبق التسجيل في حلقة تحفيظ؟ *</Label>
              <RadioGroup value={form.previous_enrollment} onValueChange={(v) => set("previous_enrollment", v)} className="flex gap-3">
                <div className="flex items-center gap-1"><RadioGroupItem value="نعم" id="prev-yes" /><Label htmlFor="prev-yes" className="font-normal cursor-pointer">نعم</Label></div>
                <div className="flex items-center gap-1"><RadioGroupItem value="لا" id="prev-no" /><Label htmlFor="prev-no" className="font-normal cursor-pointer">لا</Label></div>
              </RadioGroup>
            </div>
            {form.previous_enrollment === "نعم" && (
              <Input value={form.previous_place} onChange={(e) => set("previous_place", e.target.value)} placeholder="اسم الحلقة / المجمع السابق" />
            )}
          </div>
          <div className="space-y-1">
            <Label>مقدار الحفظ الحالي *</Label>
            <Input value={form.memorization_amount} onChange={(e) => set("memorization_amount", e.target.value)} placeholder="مثال: 5 أجزاء / لا يوجد" />
          </div>
          <div className="space-y-1">
            <Label>ملاحظات (اختياري)</Label>
            <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} placeholder="أي ملاحظات إضافية..." />
          </div>
        </CardContent>
      </Card>

      {/* Commitments */}
      <Card>
        <CardContent className="pt-4">
          <div className="bg-muted/50 rounded-lg p-3 text-xs leading-relaxed text-muted-foreground border">
            <p className="font-semibold text-foreground mb-1">التعهدات:</p>
            <p>أتعهد أنا ولي الأمر بصحة البيانات المذكورة أعلاه، وأتعهد بالتزام ابني بأنظمة المجمع وتعليماته، وأتحمل المسؤولية الكاملة في حال مخالفة ذلك. كما أتعهد بمتابعة ابني في حفظ القرآن الكريم ومراجعته والتواصل المستمر مع إدارة المجمع.</p>
          </div>
        </CardContent>
      </Card>

      <Button onClick={handleSubmit} disabled={submitting} className="w-full" size="lg">
        {submitting ? "جارٍ الإرسال..." : "إرسال طلب التسجيل"}
      </Button>
    </div>
  );
};

export default EnrollmentForm;
