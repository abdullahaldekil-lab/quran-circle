import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Save } from "lucide-react";

const FIELDS: { key: string; label: string; type?: string }[] = [
  { key: "guardian_phone", label: "جوال ولي الأمر", type: "tel" },
  { key: "guardian_phone_alt", label: "الجوال البديل", type: "tel" },
  { key: "guardian_work", label: "عمل ولي الأمر" },
  { key: "student_phone", label: "جوال الطالب", type: "tel" },
  { key: "residence_location", label: "مكان السكن" },
  { key: "school_name", label: "المدرسة" },
  { key: "grade", label: "الصف" },
];

interface Props { student: any; onSaved: (updated: Record<string, string>) => void }

const GuardianStudentEditForm = ({ student, onSaved }: Props) => {
  const [form, setForm] = useState<Record<string, string>>(() =>
    Object.fromEntries(FIELDS.map((f) => [f.key, student?.[f.key] ?? ""])),
  );
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const changed = Object.fromEntries(FIELDS.filter((f) => (form[f.key] || "") !== (student?.[f.key] || "")).map((f) => [f.key, form[f.key].trim()]));
    if (!Object.keys(changed).length) { toast.info("لا توجد تغييرات"); return; }
    if (changed.guardian_phone !== undefined && !/^0?5\d{8}$|^9665\d{8}$/.test(changed.guardian_phone.replace(/\s/g, ""))) {
      toast.error("رقم جوال ولي الأمر غير صحيح"); return;
    }
    setSaving(true);
    const { error } = await supabase.rpc("guardian_update_student", { _student_id: student.id, _fields: changed });
    setSaving(false);
    if (error) { toast.error("تعذر الحفظ: " + error.message); return; }
    toast.success("تم حفظ البيانات وإبلاغ الإدارة");
    onSaved(changed);
  };

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">بيانات الطالب</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div><span className="text-muted-foreground">الاسم: </span>{student.full_name}</div>
          <div><span className="text-muted-foreground">الهوية: </span>{student.national_id || "—"}</div>
          <div className="col-span-2"><span className="text-muted-foreground">الحلقة: </span>{student.halaqat?.name || "—"}</div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {FIELDS.map((f) => (
            <div key={f.key} className="space-y-1">
              <Label htmlFor={f.key}>{f.label}</Label>
              <Input id={f.key} type={f.type || "text"} maxLength={200} value={form[f.key]} onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))} />
            </div>
          ))}
        </div>
        <Button onClick={save} disabled={saving} className="w-full"><Save className="w-4 h-4 ml-2" />{saving ? "جارٍ الحفظ..." : "حفظ التعديلات"}</Button>
      </CardContent>
    </Card>
  );
};

export default GuardianStudentEditForm;
