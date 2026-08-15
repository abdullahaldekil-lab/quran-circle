import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarDays, Plus, Trash2, MapPin, Clock } from "lucide-react";
import { formatDateSmart } from "@/lib/hijri";
import { EVENT_TYPE_LABELS } from "@/lib/tarbawi";

export default function TarbawiCalendar() {
  const { user } = useAuth();
  const [events, setEvents] = useState<any[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "", program_id: "", event_type: "program",
    event_date: new Date().toISOString().split("T")[0], event_time: "",
    location: "", description: "", visible_to_guardians: true,
  });

  const load = useCallback(async () => {
    const [e, p] = await Promise.all([
      (supabase as any).from("tarbawi_events").select("*").order("event_date"),
      (supabase as any).from("tarbawi_programs").select("id, name"),
    ]);
    setEvents(e.data || []);
    setPrograms(p.data || []);
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!form.title.trim()) { toast.error("عنوان الحدث مطلوب"); return; }
    setSaving(true);
    const { error } = await (supabase as any).from("tarbawi_events").insert({
      title: form.title.trim().slice(0, 150),
      program_id: form.program_id || null,
      event_type: form.event_type,
      event_date: form.event_date,
      event_time: form.event_time || null,
      location: form.location.trim().slice(0, 150) || null,
      description: form.description.trim().slice(0, 800) || null,
      visible_to_guardians: form.visible_to_guardians,
      created_by: user?.id ?? null,
    });
    setSaving(false);
    if (error) { toast.error("تعذر الإضافة: " + error.message); return; }
    toast.success("تمت إضافة الحدث");
    setOpen(false);
    load();
  };

  const remove = async (id: string) => {
    const { error } = await (supabase as any).from("tarbawi_events").delete().eq("id", id);
    if (error) { toast.error("تعذر الحذف: " + error.message); return; }
    toast.success("تم حذف الحدث");
    load();
  };

  const today = new Date().toISOString().split("T")[0];
  const upcoming = events.filter((e) => e.event_date >= today);
  const past = events.filter((e) => e.event_date < today);

  const list = (items: any[], dim = false) => (
    <div className="space-y-2">
      {items.map((e) => (
        <Card key={e.id} className={`border-2 ${dim ? "opacity-60" : ""}`}>
          <CardContent className="p-3 flex items-start justify-between gap-3">
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-bold text-sm">{e.title}</p>
                <Badge variant="outline" className="text-xs">
                  {EVENT_TYPE_LABELS[e.event_type] || e.event_type}
                </Badge>
                {e.visible_to_guardians && <Badge variant="secondary" className="text-xs">مرئي لأولياء الأمور</Badge>}
              </div>
              <p className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-3">
                <span>{formatDateSmart(e.event_date)}</span>
                {e.event_time && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{e.event_time}</span>}
                {e.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{e.location}</span>}
              </p>
              {e.description && <p className="text-xs mt-1">{e.description}</p>}
            </div>
            <Button size="icon" variant="ghost" aria-label="حذف الحدث" onClick={() => remove(e.id)}>
              <Trash2 className="w-4 h-4 text-destructive" />
            </Button>
          </CardContent>
        </Card>
      ))}
      {items.length === 0 && <p className="text-sm text-muted-foreground">لا توجد أحداث</p>}
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-6 max-w-3xl" dir="rtl">
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-primary" /> تقويم البرامج والأحداث
        </h1>
        <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 ml-1" /> حدث جديد</Button>
      </div>

      <h2 className="text-sm font-bold mb-2">القادم</h2>
      {list(upcoming)}
      <h2 className="text-sm font-bold mt-6 mb-2">المنقضي</h2>
      {list(past, true)}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>حدث جديد</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>العنوان *</Label>
              <Input value={form.title} maxLength={150} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>النوع</Label>
                <Select value={form.event_type} onValueChange={(v) => setForm({ ...form, event_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(EVENT_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>البرنامج</Label>
                <Select value={form.program_id} onValueChange={(v) => setForm({ ...form, program_id: v })}>
                  <SelectTrigger><SelectValue placeholder="اختياري" /></SelectTrigger>
                  <SelectContent>
                    {programs.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>التاريخ</Label>
                <Input type="date" value={form.event_date} onChange={(e) => setForm({ ...form, event_date: e.target.value })} />
              </div>
              <div>
                <Label>الوقت</Label>
                <Input type="time" value={form.event_time} onChange={(e) => setForm({ ...form, event_time: e.target.value })} />
              </div>
            </div>
            <div>
              <Label>المكان</Label>
              <Input value={form.location} maxLength={150} onChange={(e) => setForm({ ...form, location: e.target.value })} />
            </div>
            <div>
              <Label>الوصف</Label>
              <Textarea value={form.description} maxLength={800} rows={3}
                onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="vis" checked={form.visible_to_guardians}
                onCheckedChange={(v) => setForm({ ...form, visible_to_guardians: !!v })} />
              <Label htmlFor="vis" className="text-sm">إظهاره لأولياء الأمور والطلاب</Label>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={create} disabled={saving}>{saving ? "جارٍ الحفظ..." : "إضافة"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
