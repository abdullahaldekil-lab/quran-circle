import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { PROGRAMS } from "@/lib/programs";
import {
  MATERIAL_ACCEPT,
  MATERIAL_AUDIENCES,
  MATERIAL_AUDIENCE_LABELS,
  MATERIAL_LABELS,
  MATERIAL_TYPES,
  materialAudience,
  materialStoragePath,
  validateMaterial,
  type MaterialAudience,
  type MaterialType,
} from "@/lib/materialType";

export interface MaterialRow {
  id: string;
  title: string;
  description: string | null;
  material_type: string;
  url: string | null;
  file_path: string | null;
  program_key?: string | null;
  /** Who the material is intended for: students, teachers, or both. */
  audience?: string | null;
  order_index: number | null;
  active: boolean | null;
  /** Optional teaching metadata. */
  segment_order?: string | null;
  suggested_minutes?: number | null;
  usage_notes?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Null when adding, the row when editing. */
  material: MaterialRow | null;
  defaultProgramKey?: string;
  onSaved: () => void;
}

const emptyForm = {
  title: "",
  description: "",
  material_type: "book" as MaterialType,
  url: "",
  program_key: "",
  audience: "both" as MaterialAudience,
  order_index: 0,
  active: true,
  segment_order: "",
  suggested_minutes: "",
  usage_notes: "",
};


/** Add or edit an enrichment material, with a real file upload. */
const MaterialFormDialog = ({ open, onOpenChange, material, defaultProgramKey, onSaved }: Props) => {
  const { user } = useAuth();
  const [form, setForm] = useState(emptyForm);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFile(null);
    setForm(
      material
        ? {
            title: material.title,
            description: material.description ?? "",
            material_type: (material.material_type as MaterialType) || "book",
            url: material.url ?? "",
            program_key: material.program_key ?? "",
            audience: materialAudience(material.audience),
            order_index: material.order_index ?? 0,
            active: material.active ?? true,
            segment_order: material.segment_order ?? "",
            suggested_minutes:
              material.suggested_minutes == null ? "" : String(material.suggested_minutes),
            usage_notes: material.usage_notes ?? "",
          }
        : { ...emptyForm, program_key: defaultProgramKey ?? "" },
    );
  }, [open, material, defaultProgramKey]);

  const save = async () => {
    const check = validateMaterial({
      material_type: form.material_type,
      title: form.title,
      url: form.url,
      file: file ? { name: file.name, size: file.size } : null,
      hasStoredFile: !!material?.file_path,
    });
    if (!check.ok) {
      toast.error(check.error!);
      return;
    }

    setSaving(true);
    try {
      // Optional minutes: empty stays null instead of becoming 0.
      const minutes = Number(form.suggested_minutes);
      const payload: Record<string, unknown> = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        material_type: form.material_type,
        url: form.url.trim() || null,
        program_key: form.program_key || null,
        audience: form.audience,
        order_index: form.order_index,
        active: form.active,
        segment_order: form.segment_order.trim() || null,
        suggested_minutes:
          form.suggested_minutes.trim() && Number.isFinite(minutes) && minutes > 0
            ? Math.round(minutes)
            : null,
        usage_notes: form.usage_notes.trim() || null,
      };


      let id = material?.id;

      if (material) {
        const { error } = await (supabase as any)
          .from("program_materials")
          .update(payload)
          .eq("id", material.id);
        if (error) throw error;
      } else {
        const { data, error } = await (supabase as any)
          .from("program_materials")
          .insert({ ...payload, created_by: user?.id ?? null })
          .select("id")
          .single();
        if (error) throw error;
        id = data.id;
      }

      // Upload after the row exists, so the storage key can be namespaced by material id.
      if (file && id) {
        const path = materialStoragePath(form.program_key || "general", id, file.name);
        const { error: upErr } = await supabase.storage
          .from("program-materials")
          .upload(path, file, { upsert: true, contentType: file.type || undefined });
        if (upErr) throw upErr;

        const { error: linkErr } = await (supabase as any)
          .from("program_materials")
          .update({ file_path: path, mime_type: file.type || null, file_size_bytes: file.size })
          .eq("id", id);
        if (linkErr) throw linkErr;
      }

      toast.success(material ? "تم تحديث المادة" : "تمت إضافة المادة");
      onOpenChange(false);
      onSaved();
    } catch (e: any) {
      toast.error(e.message || "تعذّر الحفظ");
    } finally {
      setSaving(false);
    }
  };

  const accept = MATERIAL_ACCEPT[form.material_type];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{material ? "تعديل المادة" : "إضافة مادة"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label>العنوان</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>البرنامج</Label>
              <Select
                value={form.program_key || "none"}
                onValueChange={(v) => setForm({ ...form, program_key: v === "none" ? "" : v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">غير مصنّف</SelectItem>
                  {PROGRAMS.map((p) => (
                    <SelectItem key={p.key} value={p.key}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>النوع</Label>
              <Select
                value={form.material_type}
                onValueChange={(v) => setForm({ ...form, material_type: v as MaterialType })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MATERIAL_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{MATERIAL_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label>الرابط (يوتيوب / خارجي)</Label>
            <Input
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              placeholder="https://..."
              dir="ltr"
            />
          </div>

          {accept && (
            <div>
              <Label className="flex items-center gap-1">
                <Upload className="w-3 h-3" />
                أو ارفع ملفاً
              </Label>
              <Input type="file" accept={accept} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              {material?.file_path && !file && (
                <p className="text-xs text-muted-foreground mt-1">يوجد ملف مرفوع — اختيار ملف جديد يستبدله</p>
              )}
            </div>
          )}

          <div>
            <Label>الوصف</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>ترتيب المقاطع (اختياري)</Label>
              <Input
                value={form.segment_order}
                onChange={(e) => setForm({ ...form, segment_order: e.target.value })}
                placeholder="مثال: المقطع 1 ثم 3 ثم 5"
              />
            </div>
            <div>
              <Label>الوقت المقترح بالدقائق (اختياري)</Label>
              <Input
                type="number"
                min={1}
                value={form.suggested_minutes}
                onChange={(e) => setForm({ ...form, suggested_minutes: e.target.value })}
                placeholder="مثال: 15"
              />
            </div>
          </div>

          <div>
            <Label>إرشادات الاستخدام (اختياري)</Label>
            <Textarea
              value={form.usage_notes}
              onChange={(e) => setForm({ ...form, usage_notes: e.target.value })}
              placeholder="كيف تُستخدم المادة داخل الحلقة أو البرنامج؟"
            />
          </div>


          <div className="grid grid-cols-2 gap-3 items-end">
            <div>
              <Label>الترتيب</Label>
              <Input
                type="number"
                value={form.order_index}
                onChange={(e) => setForm({ ...form, order_index: Number(e.target.value) || 0 })}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border p-2">
              <Label className="text-sm">ظاهرة</Label>
              <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={save} disabled={saving}>{saving ? "جارٍ الحفظ..." : "حفظ"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MaterialFormDialog;
