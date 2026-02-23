import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";

interface Template {
  id: string;
  code: string;
  title: string;
  body: string;
  default_channels: string[];
  is_active: boolean;
  category: string;
}

const CHANNELS = [
  { value: "inApp", label: "داخلي" },
  { value: "email", label: "بريد إلكتروني" },
  { value: "whatsapp", label: "واتساب" },
];

const CATEGORIES = [
  { value: "academic", label: "أكاديمي" },
  { value: "attendance", label: "حضور" },
  { value: "system", label: "نظام" },
  { value: "rewards", label: "مكافآت" },
];

const NotificationTemplates = () => {
  const { isManager } = useRole();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
  const [form, setForm] = useState({
    code: "", title: "", body: "", default_channels: ["inApp"] as string[], is_active: true, category: "system",
  });

  const fetchTemplates = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("notification_templates")
      .select("*")
      .order("category", { ascending: true });
    setTemplates((data as Template[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchTemplates(); }, []);

  const handleSave = async () => {
    if (!form.code || !form.title || !form.body) {
      toast.error("يرجى ملء جميع الحقول المطلوبة");
      return;
    }
    if (editing) {
      const { error } = await supabase
        .from("notification_templates")
        .update({ title: form.title, body: form.body, default_channels: form.default_channels, is_active: form.is_active, category: form.category })
        .eq("id", editing.id);
      if (error) { toast.error("فشل التحديث"); return; }
      toast.success("تم التحديث");
    } else {
      const { error } = await supabase
        .from("notification_templates")
        .insert([{ code: form.code, title: form.title, body: form.body, default_channels: form.default_channels, is_active: form.is_active, category: form.category }]);
      if (error) { toast.error(error.message); return; }
      toast.success("تم الإضافة");
    }
    setDialogOpen(false);
    setEditing(null);
    fetchTemplates();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("notification_templates").delete().eq("id", id);
    if (error) { toast.error("فشل الحذف"); return; }
    toast.success("تم الحذف");
    fetchTemplates();
  };

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from("notification_templates").update({ is_active: active }).eq("id", id);
    fetchTemplates();
  };

  const openEdit = (t: Template) => {
    setEditing(t);
    setForm({ code: t.code, title: t.title, body: t.body, default_channels: t.default_channels, is_active: t.is_active, category: t.category });
    setDialogOpen(true);
  };

  const openNew = () => {
    setEditing(null);
    setForm({ code: "", title: "", body: "", default_channels: ["inApp"], is_active: true, category: "system" });
    setDialogOpen(true);
  };

  const toggleChannel = (ch: string) => {
    setForm((prev) => ({
      ...prev,
      default_channels: prev.default_channels.includes(ch)
        ? prev.default_channels.filter((c) => c !== ch)
        : [...prev.default_channels, ch],
    }));
  };

  if (!isManager) return <div className="p-8 text-center text-muted-foreground">غير مصرح</div>;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">إدارة قوالب الإشعارات</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openNew}><Plus className="w-4 h-4 ml-2" /> إضافة قالب</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg" dir="rtl">
            <DialogHeader><DialogTitle>{editing ? "تعديل القالب" : "إضافة قالب جديد"}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>الكود</Label>
                <Input value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))} disabled={!!editing} placeholder="مثال: STUDENT_ABSENT" />
              </div>
              <div>
                <Label>العنوان</Label>
                <Input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
              </div>
              <div>
                <Label>النص (يدعم {"{studentName}"}, {"{date}"}...)</Label>
                <Textarea value={form.body} onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))} rows={3} />
              </div>
              <div>
                <Label>التصنيف</Label>
                <Select value={form.category} onValueChange={(v) => setForm((p) => ({ ...p, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>القنوات الافتراضية</Label>
                <div className="flex gap-4 mt-2">
                  {CHANNELS.map((ch) => (
                    <label key={ch.value} className="flex items-center gap-2 text-sm">
                      <Checkbox checked={form.default_channels.includes(ch.value)} onCheckedChange={() => toggleChannel(ch.value)} />
                      {ch.label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm((p) => ({ ...p, is_active: v }))} />
                <Label>مفعّل</Label>
              </div>
              <Button onClick={handleSave} className="w-full">حفظ</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="text-center p-8 text-muted-foreground">جارٍ التحميل...</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الكود</TableHead>
              <TableHead>العنوان</TableHead>
              <TableHead>التصنيف</TableHead>
              <TableHead>القنوات</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead>إجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {templates.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-mono text-xs">{t.code}</TableCell>
                <TableCell>{t.title}</TableCell>
                <TableCell>{CATEGORIES.find((c) => c.value === t.category)?.label || t.category}</TableCell>
                <TableCell>
                  <div className="flex gap-1 flex-wrap">
                    {t.default_channels.map((ch) => (
                      <span key={ch} className="text-[10px] bg-muted px-1.5 py-0.5 rounded">
                        {CHANNELS.find((c) => c.value === ch)?.label || ch}
                      </span>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <Switch checked={t.is_active} onCheckedChange={(v) => toggleActive(t.id, v)} />
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(t)}><Pencil className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(t.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
};

export default NotificationTemplates;
