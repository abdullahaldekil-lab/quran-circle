import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { BookOpen, Pencil, Plus, Save, ScrollText } from "lucide-react";
import { useRole } from "@/hooks/useRole";

interface Curriculum {
  id: string;
  code: string;
  name: string;
  description: string | null;
  total_weeks: number;
  year_hijri: string | null;
  notes: string | null;
  active: boolean;
}
interface Week { id: string; curriculum_id: string; week_number: number; title: string | null; lesson_topic: string | null; }
interface Day {
  id: string; week_id: string; day_name: string; day_order: number;
  lesson: string | null; quran_homework: string | null; written_homework: string | null;
  educational: string | null; reading_in_class: string | null; reading_at_home: string | null; notes: string | null;
}

const TalqeenCurricula = () => {
  const { isManager, isSupervisor } = useRole();
  const canEdit = isManager || isSupervisor;
  const [curricula, setCurricula] = useState<Curriculum[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [daysByWeek, setDaysByWeek] = useState<Record<string, Day[]>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({ code: "", name: "", description: "", total_weeks: 10, year_hijri: "1447" });
  const [editDay, setEditDay] = useState<Day | null>(null);
  const [editWeek, setEditWeek] = useState<Week | null>(null);

  const loadCurricula = async () => {
    const { data } = await supabase.from("talqeen_curricula" as any).select("*").order("code");
    setCurricula((data as any) || []);
    if (data && data.length && !selectedId) setSelectedId((data[0] as any).id);
  };

  const loadDetail = async (cid: string) => {
    const { data: ws } = await supabase.from("talqeen_curriculum_weeks" as any).select("*").eq("curriculum_id", cid).order("week_number");
    setWeeks((ws as any) || []);
    if (ws && ws.length) {
      const wIds = (ws as any[]).map((w) => w.id);
      const { data: ds } = await supabase.from("talqeen_curriculum_days" as any).select("*").in("week_id", wIds).order("day_order");
      const grouped: Record<string, Day[]> = {};
      ((ds as any[]) || []).forEach((d) => { (grouped[d.week_id] ||= []).push(d); });
      setDaysByWeek(grouped);
    } else setDaysByWeek({});
  };

  useEffect(() => { loadCurricula(); }, []);
  useEffect(() => { if (selectedId) loadDetail(selectedId); }, [selectedId]);

  const handleCreate = async () => {
    if (!createForm.code || !createForm.name) { toast.error("الكود والاسم مطلوبان"); return; }
    const { error } = await supabase.from("talqeen_curricula" as any).insert(createForm as any);
    if (error) { toast.error(error.message); return; }
    toast.success("تم إنشاء المنهج");
    setCreateOpen(false);
    setCreateForm({ code: "", name: "", description: "", total_weeks: 10, year_hijri: "1447" });
    loadCurricula();
  };

  const handleSaveDay = async () => {
    if (!editDay) return;
    const { id, ...rest } = editDay as any;
    const { error } = await supabase.from("talqeen_curriculum_days" as any).update(rest).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("تم الحفظ");
    setEditDay(null);
    loadDetail(selectedId);
  };

  const handleSaveWeek = async () => {
    if (!editWeek) return;
    const { id, ...rest } = editWeek as any;
    const { error } = await supabase.from("talqeen_curriculum_weeks" as any).update({ title: rest.title, lesson_topic: rest.lesson_topic }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("تم تحديث الأسبوع");
    setEditWeek(null);
    loadDetail(selectedId);
  };

  const selected = curricula.find((c) => c.id === selectedId);

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6" dir="rtl">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <ScrollText className="w-8 h-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">مناهج التلقين</h1>
            <p className="text-sm text-muted-foreground">خطط المستويات (الأول، الثاني، الثالث، الرابع أ/ب/ج) لعام 1447هـ</p>
          </div>
        </div>
        {canEdit && (
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild><Button><Plus className="w-4 h-4 ml-1" /> منهج جديد</Button></DialogTrigger>
            <DialogContent dir="rtl">
              <DialogHeader><DialogTitle>إضافة منهج جديد</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>الكود *</Label><Input value={createForm.code} onChange={(e) => setCreateForm({ ...createForm, code: e.target.value })} placeholder="LEVEL_5" /></div>
                <div><Label>الاسم *</Label><Input value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} /></div>
                <div><Label>الوصف</Label><Textarea value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>عدد الأسابيع</Label><Input type="number" value={createForm.total_weeks} onChange={(e) => setCreateForm({ ...createForm, total_weeks: +e.target.value })} /></div>
                  <div><Label>السنة الهجرية</Label><Input value={createForm.year_hijri} onChange={(e) => setCreateForm({ ...createForm, year_hijri: e.target.value })} /></div>
                </div>
              </div>
              <DialogFooter><Button onClick={handleCreate}>إنشاء</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Tabs value={selectedId} onValueChange={setSelectedId} className="w-full">
        <TabsList className="flex flex-wrap h-auto">
          {curricula.map((c) => (
            <TabsTrigger key={c.id} value={c.id} className="text-xs sm:text-sm">{c.name}</TabsTrigger>
          ))}
        </TabsList>

        {curricula.map((c) => (
          <TabsContent key={c.id} value={c.id} className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between flex-wrap gap-2">
                  <div>
                    <CardTitle className="flex items-center gap-2"><BookOpen className="w-5 h-5" />{c.name}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">{c.description}</p>
                  </div>
                  <div className="flex gap-2 items-center">
                    <Badge variant="outline">{c.total_weeks} أسبوع</Badge>
                    <Badge variant="secondary">{c.year_hijri}هـ</Badge>
                    <Badge variant="outline">{c.code}</Badge>
                  </div>
                </div>
              </CardHeader>
            </Card>

            <Accordion type="single" collapsible className="space-y-2">
              {weeks.map((w) => (
                <AccordionItem key={w.id} value={w.id} className="border rounded-lg bg-card">
                  <AccordionTrigger className="px-4 hover:no-underline">
                    <div className="flex items-center justify-between w-full pl-2">
                      <div className="text-right">
                        <span className="font-bold ml-2">{w.title || `الأسبوع ${w.week_number}`}</span>
                        {w.lesson_topic && <span className="text-sm text-muted-foreground"> — {w.lesson_topic}</span>}
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    {canEdit && (
                      <Button variant="ghost" size="sm" className="mb-2" onClick={(e) => { e.stopPropagation(); setEditWeek(w); }}>
                        <Pencil className="w-3 h-3 ml-1" /> تعديل عنوان الأسبوع
                      </Button>
                    )}
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="text-right">اليوم</TableHead>
                            <TableHead className="text-right">الدرس</TableHead>
                            <TableHead className="text-right">الواجب القرآني</TableHead>
                            <TableHead className="text-right">الواجب الكتابي</TableHead>
                            <TableHead className="text-right">القراءة بالدرس</TableHead>
                            <TableHead className="text-right">القراءة بالبيت</TableHead>
                            <TableHead className="text-right">التربوي</TableHead>
                            {canEdit && <TableHead></TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(daysByWeek[w.id] || []).map((d) => (
                            <TableRow key={d.id}>
                              <TableCell className="font-medium">{d.day_name}</TableCell>
                              <TableCell className="text-xs">{d.lesson || "—"}</TableCell>
                              <TableCell className="text-xs">{d.quran_homework || "—"}</TableCell>
                              <TableCell className="text-xs">{d.written_homework || "—"}</TableCell>
                              <TableCell className="text-xs">{d.reading_in_class || "—"}</TableCell>
                              <TableCell className="text-xs">{d.reading_at_home || "—"}</TableCell>
                              <TableCell className="text-xs">{d.educational || "—"}</TableCell>
                              {canEdit && (
                                <TableCell>
                                  <Button variant="ghost" size="icon" onClick={() => setEditDay(d)}><Pencil className="w-3 h-3" /></Button>
                                </TableCell>
                              )}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </TabsContent>
        ))}
      </Tabs>

      {/* Edit Day Dialog */}
      <Dialog open={!!editDay} onOpenChange={(o) => !o && setEditDay(null)}>
        <DialogContent dir="rtl" className="max-w-2xl">
          <DialogHeader><DialogTitle>تعديل يوم: {editDay?.day_name}</DialogTitle></DialogHeader>
          {editDay && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label>الدرس</Label><Input value={editDay.lesson || ""} onChange={(e) => setEditDay({ ...editDay, lesson: e.target.value })} /></div>
              <div><Label>الواجب القرآني</Label><Input value={editDay.quran_homework || ""} onChange={(e) => setEditDay({ ...editDay, quran_homework: e.target.value })} /></div>
              <div><Label>الواجب الكتابي</Label><Input value={editDay.written_homework || ""} onChange={(e) => setEditDay({ ...editDay, written_homework: e.target.value })} /></div>
              <div><Label>القراءة بالدرس</Label><Input value={editDay.reading_in_class || ""} onChange={(e) => setEditDay({ ...editDay, reading_in_class: e.target.value })} /></div>
              <div><Label>القراءة بالبيت</Label><Input value={editDay.reading_at_home || ""} onChange={(e) => setEditDay({ ...editDay, reading_at_home: e.target.value })} /></div>
              <div><Label>التربوي</Label><Input value={editDay.educational || ""} onChange={(e) => setEditDay({ ...editDay, educational: e.target.value })} /></div>
              <div className="sm:col-span-2"><Label>ملاحظات</Label><Textarea value={editDay.notes || ""} onChange={(e) => setEditDay({ ...editDay, notes: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter><Button onClick={handleSaveDay}><Save className="w-4 h-4 ml-1" /> حفظ</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Week Dialog */}
      <Dialog open={!!editWeek} onOpenChange={(o) => !o && setEditWeek(null)}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>تعديل الأسبوع</DialogTitle></DialogHeader>
          {editWeek && (
            <div className="space-y-3">
              <div><Label>العنوان</Label><Input value={editWeek.title || ""} onChange={(e) => setEditWeek({ ...editWeek, title: e.target.value })} /></div>
              <div><Label>موضوع الدرس</Label><Input value={editWeek.lesson_topic || ""} onChange={(e) => setEditWeek({ ...editWeek, lesson_topic: e.target.value })} /></div>
            </div>
          )}
          <DialogFooter><Button onClick={handleSaveWeek}><Save className="w-4 h-4 ml-1" /> حفظ</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TalqeenCurricula;
