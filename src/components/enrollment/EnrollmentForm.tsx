import { useState, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { BookOpen, User, Heart, GraduationCap, FileText } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const anonClient = createClient(SUPABASE_URL, SUPABASE_KEY);

export interface EnrollmentFormData {
  // Student info
  student_full_name: string;
  student_nationality: string;
  student_birth_date_hijri: string;
  student_birth_date_gregorian: string;
  student_id_number: string;
  student_school: string;
  student_grade: string;
  // Social
  living_with: string;
  parents_status: string;
  // Guardian
  guardian_full_name: string;
  guardian_relationship: string;
  guardian_id_number: string;
  guardian_phone: string;
  guardian_address: string;
  // Health
  has_chronic_diseases: string;
  chronic_diseases_details: string;
  has_medications: string;
  medications_details: string;
  has_allergies: string;
  allergies_details: string;
  // Quran info
  previous_enrollment: string;
  previous_place: string;
  memorization_amount: string;
  requested_halaqa_id: string;
  preferred_time: string;
  // Other
  notes: string;
}

const initialFormData: EnrollmentFormData = {
  student_full_name: "",
  student_nationality: "سعودي",
  student_birth_date_hijri: "",
  student_birth_date_gregorian: "",
  student_id_number: "",
  student_school: "",
  student_grade: "",
  living_with: "والديه",
  parents_status: "مستقرة",
  guardian_full_name: "",
  guardian_relationship: "أب",
  guardian_id_number: "",
  guardian_phone: "",
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
  requested_halaqa_id: "",
  preferred_time: "",
  notes: "",
};

interface Props {
  onSubmitted: (data: EnrollmentFormData) => void;
}

const EnrollmentForm = ({ onSubmitted }: Props) => {
  const [halaqat, setHalaqat] = useState<{ id: string; name: string }[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<EnrollmentFormData>(initialFormData);

  useEffect(() => {
    anonClient.from("halaqat").select("id, name").eq("active", true).order("name").then(({ data }) => {
      setHalaqat(data || []);
    });
  }, []);

  const set = (key: keyof EnrollmentFormData, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    if (!form.student_full_name.trim() || !form.guardian_full_name.trim() || !form.guardian_phone.trim()) {
      toast.error("اسم الطالب واسم ولي الأمر ورقم الجوال مطلوبة");
      return;
    }

    const phoneClean = form.guardian_phone.replace(/\s/g, "");
    if (phoneClean.length < 9) {
      toast.error("رقم الهاتف غير صحيح");
      return;
    }

    // Rate limit
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

    const { student_full_name, guardian_full_name, guardian_phone, requested_halaqa_id, preferred_time, notes, student_birth_date_gregorian, ...extraFields } = form;

    const birthYear = student_birth_date_gregorian ? parseInt(student_birth_date_gregorian.split("-")[0] || student_birth_date_gregorian.split("/")[0]) : null;

    const { error } = await anonClient.from("enrollment_requests").insert({
      student_full_name: student_full_name.trim(),
      guardian_full_name: guardian_full_name.trim(),
      guardian_phone: phoneClean,
      student_birth_year: birthYear && !isNaN(birthYear) ? birthYear : null,
      requested_halaqa_id: requested_halaqa_id || null,
      preferred_time: preferred_time.trim() || null,
      notes: notes.trim() || null,
      form_data: {
        ...extraFields,
        student_birth_date_gregorian,
      },
    });

    setSubmitting(false);

    if (error) {
      toast.error("حدث خطأ. يرجى المحاولة مجدداً");
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
              <Label>الجنسية</Label>
              <Input value={form.student_nationality} onChange={(e) => set("student_nationality", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>رقم الهوية / الإقامة</Label>
              <Input value={form.student_id_number} onChange={(e) => set("student_id_number", e.target.value)} dir="ltr" className="text-right" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>تاريخ الميلاد هجري</Label>
              <Input value={form.student_birth_date_hijri} onChange={(e) => set("student_birth_date_hijri", e.target.value)} placeholder="مثال: 1437/05/15" dir="ltr" className="text-right" />
            </div>
            <div className="space-y-1">
              <Label>تاريخ الميلاد ميلادي</Label>
              <Input value={form.student_birth_date_gregorian} onChange={(e) => set("student_birth_date_gregorian", e.target.value)} placeholder="مثال: 2015/08/20" dir="ltr" className="text-right" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>المدرسة</Label>
              <Input value={form.student_school} onChange={(e) => set("student_school", e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>الصف الدراسي</Label>
              <Input value={form.student_grade} onChange={(e) => set("student_grade", e.target.value)} />
            </div>
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
            <Label>من يعيش معه الطالب</Label>
            <RadioGroup value={form.living_with} onValueChange={(v) => set("living_with", v)} className="flex flex-wrap gap-4">
              {["والديه", "الأب", "الأم", "أخرى"].map((opt) => (
                <div key={opt} className="flex items-center gap-1.5">
                  <RadioGroupItem value={opt} id={`living-${opt}`} />
                  <Label htmlFor={`living-${opt}`} className="font-normal cursor-pointer">{opt}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>
          <div className="space-y-1">
            <Label>الحالة الاجتماعية للوالدين</Label>
            <RadioGroup value={form.parents_status} onValueChange={(v) => set("parents_status", v)} className="flex flex-wrap gap-4">
              {["مستقرة", "منفصلين", "متوفى الأب", "متوفاة الأم"].map((opt) => (
                <div key={opt} className="flex items-center gap-1.5">
                  <RadioGroupItem value={opt} id={`parents-${opt}`} />
                  <Label htmlFor={`parents-${opt}`} className="font-normal cursor-pointer">{opt}</Label>
                </div>
              ))}
            </RadioGroup>
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
              <Label>صلة القرابة</Label>
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
              <Label>رقم هوية ولي الأمر</Label>
              <Input value={form.guardian_id_number} onChange={(e) => set("guardian_id_number", e.target.value)} dir="ltr" className="text-right" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>رقم الجوال *</Label>
              <Input value={form.guardian_phone} onChange={(e) => set("guardian_phone", e.target.value)} placeholder="05xxxxxxxx" dir="ltr" className="text-right" type="tel" />
            </div>
            <div className="space-y-1">
              <Label>عنوان السكن</Label>
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
            { key: "has_chronic_diseases" as const, detail: "chronic_diseases_details" as const, label: "هل يعاني الطالب من أمراض مزمنة؟" },
            { key: "has_medications" as const, detail: "medications_details" as const, label: "هل يستخدم أدوية بشكل مستمر؟" },
            { key: "has_allergies" as const, detail: "allergies_details" as const, label: "هل يعاني من حساسية؟" },
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
              <Label className="flex-1">هل سبق التسجيل في حلقة تحفيظ؟</Label>
              <RadioGroup value={form.previous_enrollment} onValueChange={(v) => set("previous_enrollment", v)} className="flex gap-3">
                <div className="flex items-center gap-1"><RadioGroupItem value="نعم" id="prev-yes" /><Label htmlFor="prev-yes" className="font-normal cursor-pointer">نعم</Label></div>
                <div className="flex items-center gap-1"><RadioGroupItem value="لا" id="prev-no" /><Label htmlFor="prev-no" className="font-normal cursor-pointer">لا</Label></div>
              </RadioGroup>
            </div>
            {form.previous_enrollment === "نعم" && (
              <Input value={form.previous_place} onChange={(e) => set("previous_place", e.target.value)} placeholder="اسم الحلقة / المسجد السابق" />
            )}
          </div>
          <div className="space-y-1">
            <Label>مقدار الحفظ الحالي</Label>
            <Input value={form.memorization_amount} onChange={(e) => set("memorization_amount", e.target.value)} placeholder="مثال: 5 أجزاء" />
          </div>
          <div className="space-y-1">
            <Label>الحلقة المطلوبة (اختياري)</Label>
            <Select value={form.requested_halaqa_id} onValueChange={(v) => set("requested_halaqa_id", v)}>
              <SelectTrigger><SelectValue placeholder="اختر الحلقة" /></SelectTrigger>
              <SelectContent>
                {halaqat.map((h) => (
                  <SelectItem key={h.id} value={h.id}>
                    <span className="flex items-center gap-2"><BookOpen className="w-3 h-3" />{h.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label>الوقت المفضل (اختياري)</Label>
            <Input value={form.preferred_time} onChange={(e) => set("preferred_time", e.target.value)} placeholder="مثال: بعد العصر" />
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
