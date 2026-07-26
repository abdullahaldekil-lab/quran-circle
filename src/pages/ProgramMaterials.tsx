import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Book, Video, FileText, Link as LinkIcon, Plus, Trash2, ExternalLink, Library } from "lucide-react";

type Material = {
  id: string; title: string; description: string | null; material_type: string;
  url: string | null; file_path: string | null; program_id: string | null;
  order_index: number | null; active: boolean | null;
};

const TYPE_META: Record<string, { label: string; icon: any; color: string }> = {
  book: { label: "كتاب", icon: Book, color: "text-emerald-500" },
  video: { label: "فيديو", icon: Video, color: "text-red-500" },
  audio: { label: "صوت", icon: Video, color: "text-blue-500" },
  file: { label: "ملف", icon: FileText, color: "text-amber-500" },
  link: { label: "رابط", icon: LinkIcon, color: "text-purple-500" },
};

export default function ProgramMaterials() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", material_type: "book", url: "", program_id: "" });

  useEffect(() => { load(); }, []);
  async function load() {
    const { data, error } = await supabase.from("program_materials").select("*").order("order_index", { ascending: true }).order("created_at", { ascending: false });
    if (error) return toast.error(error.message);
    setMaterials((data || []) as any);
  }
  async function save() {
    if (!form.title) return toast.error("أدخل عنوان المادة");
    const payload: any = { ...form };
    if (!payload.program_id) delete payload.program_id;
    const { error } = await supabase.from("program_materials").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("تمت الإضافة"); setOpen(false);
    setForm({ title: "", description: "", material_type: "book", url: "", program_id: "" });
    load();
  }
  async function remove(id: string) {
    if (!confirm("حذف المادة؟")) return;
    const { error } = await supabase.from("program_materials").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  }

  const filtered = filter === "all" ? materials : materials.filter(m => m.material_type === filter);

  return (
    <div className="p-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <Library className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">مواد البرامج الإثرائية</h1>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="w-4 h-4 ml-1" />مادة جديدة</Button></DialogTrigger>
          <DialogContent dir="rtl">
            <DialogHeader><DialogTitle>إضافة مادة</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>العنوان</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
              <div><Label>النوع</Label>
                <Select value={form.material_type} onValueChange={v => setForm({ ...form, material_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_META).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>الرابط (يوتيوب / خارجي)</Label><Input value={form.url} onChange={e => setForm({ ...form, url: e.target.value })} placeholder="https://..." /></div>
              <div><Label>الوصف</Label><Textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={save}>حفظ</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>الكل</Button>
        {Object.entries(TYPE_META).map(([k, v]) => (
          <Button key={k} size="sm" variant={filter === k ? "default" : "outline"} onClick={() => setFilter(k)}>{v.label}</Button>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {filtered.map(m => {
          const meta = TYPE_META[m.material_type] || TYPE_META.link;
          const Icon = meta.icon;
          return (
            <Card key={m.id}>
              <CardContent className="pt-4">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex items-start gap-2 flex-1">
                    <Icon className={`w-5 h-5 mt-1 ${meta.color}`} />
                    <div className="flex-1">
                      <p className="font-semibold">{m.title}</p>
                      {m.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{m.description}</p>}
                      <Badge variant="outline" className="mt-2">{meta.label}</Badge>
                    </div>
                  </div>
                  <Button aria-label="حذف" variant="ghost" size="icon" onClick={() => remove(m.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </div>
                {m.url && (
                  <a href={m.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline">
                    <ExternalLink className="w-3 h-3" />فتح
                  </a>
                )}
              </CardContent>
            </Card>
          );
        })}
        {!filtered.length && <p className="text-muted-foreground col-span-full text-center py-8">لا توجد مواد بعد.</p>}
      </div>
    </div>
  );
}
