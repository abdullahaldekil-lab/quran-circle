import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { halaqatTalqeen } from "@/lib/halaqaType";
import ContentViewer, { lessonTypeIcon, lessonTypeLabel } from "@/components/talqeen/ContentViewer";
import { BookOpen, Plus, Pencil, Trash2, Eye, Send, X, ChevronRight, BookCopy } from "lucide-react";

const GRADE_GROUPS = ["روضة", "1-2", "3-4", "5-6"];
const LESSON_TYPES = [
  { value: "manual", label: "نص مكتوب" },
  { value: "pdf", label: "ملف PDF" },
  { value: "audio", label: "صوت" },
  { value: "video", label: "فيديو" },
];

const TalqeenPrograms = () => {
  const { role, isManager, isSupervisor } = useRole();
  const canManage = isManager || isSupervisor;
  const canAssign = isManager || role === "supervisor" || role === "assistant_supervisor";

  const [tab, setTab] = useState("programs");

  // ---- Programs tab data
  const [curricula, setCurricula] = useState<any[]>([]);
  const [selectedCurriculumId, setSelectedCurriculumId] = useState<string | null>(null);
  const [chapters, setChapters] = useState<any[]>([]);
  const [lessonsByChapter, setLessonsByChapter] = useState<Record<string, any[]>>({});

  // dialogs
  const [chapterDialog, setChapterDialog] = useState(false);
  const [editingChapter, setEditingChapter] = useState<any | null>(null);
  const [chapterForm, setChapterForm] = useState({ chapter_number: 1, title: "", grade_group: "روضة", description: "" });

  const [lessonDialog, setLessonDialog] = useState(false);
  const [editingLesson, setEditingLesson] = useState<any | null>(null);
  const [activeChapterId, setActiveChapterId] = useState<string | null>(null);
  const [lessonForm, setLessonForm] = useState<any>({
    lesson_number: 1,
    title: "",
    lesson_type: "manual",
    content: "",
    pdf_url: "",
    audio_url: "",
    video_url: "",
    estimated_duration_minutes: "",
    notes: "",
  });

  // viewer
  const [viewerLesson, setViewerLesson] = useState<any | null>(null);

  // ---- Assign tab
  const [talqeenHalaqat, setTalqeenHalaqat] = useState<any[]>([]);
  const [selectedHalaqaId, setSelectedHalaqaId] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [assignCurriculum, setAssignCurriculum] = useState<string>("");
  const [assignStartDate, setAssignStartDate] = useState<string>("");

  // ---- Progress tab
  const [progressRows, setProgressRows] = useState<any[]>([]);

  useEffect(() => { loadCurricula(); loadHalaqat(); }, []);
  useEffect(() => { if (selectedCurriculumId) loadChapters(selectedCurriculumId); }, [selectedCurriculumId]);
  useEffect(() => { if (selectedHalaqaId) loadAssignments(selectedHalaqaId); }, [selectedHalaqaId]);
  useEffect(() => { if (tab === "progress") loadProgressOverview(); }, [tab]);

  const loadCurricula = async () => {
    const { data } = await supabase.from("talqeen_curricula").select("id, name").order("name");
    setCurricula(data || []);
    if (data && data.length && !selectedCurriculumId) setSelectedCurriculumId(data[0].id);
  };

  const loadChapters = async (cid: string) => {
    const { data: ch } = await (supabase as any)
      .from("talqeen_chapters").select("*").eq("curriculum_id", cid)
      .order("sort_order").order("chapter_number");
    setChapters(ch || []);
    const ids = (ch || []).map((c: any) => c.id);
    if (ids.length === 0) { setLessonsByChapter({}); return; }
    const { data: les } = await (supabase as any)
      .from("talqeen_lessons").select("*").in("chapter_id", ids).order("lesson_number");
    const grouped: Record<string, any[]> = {};
    (les || []).forEach((l: any) => {
      grouped[l.chapter_id] = grouped[l.chapter_id] || [];
      grouped[l.chapter_id].push(l);
    });
    setLessonsByChapter(grouped);
  };

  const loadHalaqat = async () => {
    const { data } = await halaqatTalqeen().select("id, name").order("name");
    setTalqeenHalaqat(data || []);
  };

  const loadAssignments = async (halaqaId: string) => {
    const { data } = await (supabase as any)
      .from("talqeen_program_assignments")
      .select("*, talqeen_curricula(name)")
      .eq("halaqa_id", halaqaId)
      .order("assigned_at", { ascending: false });
    setAssignments(data || []);
  };

  // ---------- Chapter CRUD
  const openNewChapter = () => {
    setEditingChapter(null);
    setChapterForm({ chapter_number: chapters.length + 1, title: "", grade_group: "روضة", description: "" });
    setChapterDialog(true);
  };
  const openEditChapter = (c: any) => {
    setEditingChapter(c);
    setChapterForm({ chapter_number: c.chapter_number, title: c.title, grade_group: c.grade_group, description: c.description || "" });
    setChapterDialog(true);
  };
  const saveChapter = async () => {
    if (!selectedCurriculumId) return;
    if (!chapterForm.title.trim()) { toast.error("العنوان مطلوب"); return; }
    const payload = { ...chapterForm, curriculum_id: selectedCurriculumId };
    const q = editingChapter
      ? (supabase as any).from("talqeen_chapters").update(payload).eq("id", editingChapter.id)
      : (supabase as any).from("talqeen_chapters").insert(payload);
    const { error } = await q;
    if (error) { toast.error(error.message); return; }
    toast.success("تم الحفظ");
    setChapterDialog(false);
    loadChapters(selectedCurriculumId);
  };
  const deleteChapter = async (id: string) => {
    if (!confirm("حذف الباب وكل دروسه؟")) return;
    const { error } = await (supabase as any).from("talqeen_chapters").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("تم الحذف");
    if (selectedCurriculumId) loadChapters(selectedCurriculumId);
  };

  // ---------- Lesson CRUD
  const openNewLesson = (chapterId: string) => {
    setActiveChapterId(chapterId);
    setEditingLesson(null);
    const count = (lessonsByChapter[chapterId] || []).length;
    setLessonForm({
      lesson_number: count + 1, title: "", lesson_type: "manual",
      content: "", pdf_url: "", audio_url: "", video_url: "",
      estimated_duration_minutes: "", notes: "",
    });
    setLessonDialog(true);
  };
  const openEditLesson = (l: any) => {
    setActiveChapterId(l.chapter_id);
    setEditingLesson(l);
    setLessonForm({
      lesson_number: l.lesson_number, title: l.title, lesson_type: l.lesson_type || "manual",
      content: l.content || "", pdf_url: l.pdf_url || "", audio_url: l.audio_url || "", video_url: l.video_url || "",
      estimated_duration_minutes: l.estimated_duration_minutes || "", notes: l.notes || "",
    });
    setLessonDialog(true);
  };
  const saveLesson = async () => {
    if (!activeChapterId) return;
    if (!lessonForm.title.trim()) { toast.error("العنوان مطلوب"); return; }
    const { data: { user } } = await supabase.auth.getUser();
    const payload: any = {
      chapter_id: activeChapterId,
      lesson_number: Number(lessonForm.lesson_number) || 1,
      title: lessonForm.title,
      lesson_type: lessonForm.lesson_type,
      content: lessonForm.lesson_type === "manual" ? lessonForm.content : null,
      pdf_url: lessonForm.lesson_type === "pdf" ? lessonForm.pdf_url : null,
      audio_url: lessonForm.lesson_type === "audio" ? lessonForm.audio_url : null,
      video_url: lessonForm.lesson_type === "video" ? lessonForm.video_url : null,
      estimated_duration_minutes: lessonForm.estimated_duration_minutes ? Number(lessonForm.estimated_duration_minutes) : null,
      notes: lessonForm.notes || null,
      created_by: user?.id,
    };
    const q = editingLesson
      ? (supabase as any).from("talqeen_lessons").update(payload).eq("id", editingLesson.id)
      : (supabase as any).from("talqeen_lessons").insert(payload);
    const { error } = await q;
    if (error) { toast.error(error.message); return; }
    toast.success("تم الحفظ");
    setLessonDialog(false);
    if (selectedCurriculumId) loadChapters(selectedCurriculumId);
  };
  const deleteLesson = async (id: string) => {
    if (!confirm("حذف الدرس؟")) return;
    const { error } = await (supabase as any).from("talqeen_lessons").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("تم الحذف");
    if (selectedCurriculumId) loadChapters(selectedCurriculumId);
  };

  // ---------- Assign program
  const assignProgram = async () => {
    if (!selectedHalaqaId || !assignCurriculum) { toast.error("اختر برنامجاً"); return; }
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await (supabase as any).from("talqeen_program_assignments").insert({
      curriculum_id: assignCurriculum,
      halaqa_id: selectedHalaqaId,
      assigned_by: user?.id,
      start_date: assignStartDate || null,
      is_active: true,
    });
    if (error) { toast.error(error.message); return; }
    // notify teacher
    const { data: h } = await supabase.from("halaqat" as any).select("teacher_id").eq("id", selectedHalaqaId).maybeSingle();
    if ((h as any)?.teacher_id) {
      await supabase.from("notifications" as any).insert({
        user_id: (h as any).teacher_id,
        title: "إسناد برنامج تلقين جديد",
        message: "تم إسناد برنامج تلقين جديد لحلقتك",
        type: "info",
      });
    }
    toast.success("تم الإسناد");
    setAssignCurriculum(""); setAssignStartDate("");
    loadAssignments(selectedHalaqaId);
  };
  const unassign = async (id: string) => {
    if (!confirm("إلغاء إسناد هذا البرنامج؟")) return;
    const { error } = await (supabase as any).from("talqeen_program_assignments").update({ is_active: false }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("تم الإلغاء");
    if (selectedHalaqaId) loadAssignments(selectedHalaqaId);
  };

  // ---------- Progress overview
  const loadProgressOverview = async () => {
    const { data: as } = await (supabase as any)
      .from("talqeen_program_assignments")
      .select("id, halaqa_id, curriculum_id, is_active, talqeen_curricula(name), halaqat(name)")
      .eq("is_active", true);
    const list = as || [];
    const enriched = await Promise.all(list.map(async (a: any) => {
      // total lessons in this curriculum
      const { data: chs } = await (supabase as any).from("talqeen_chapters").select("id").eq("curriculum_id", a.curriculum_id);
      const chIds = (chs || []).map((c: any) => c.id);
      let total = 0;
      if (chIds.length) {
        const { count } = await (supabase as any).from("talqeen_lessons").select("id", { count: "exact", head: true }).in("chapter_id", chIds);
        total = count || 0;
      }
      const { count: done } = await (supabase as any).from("talqeen_program_progress")
        .select("id", { count: "exact", head: true })
        .eq("assignment_id", a.id).eq("status", "completed");
      return { ...a, total, completed: done || 0 };
    }));
    setProgressRows(enriched);
  };

  return (
    <div className="container mx-auto p-4 space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BookCopy className="w-6 h-6 text-primary" /> برامج التلقين
        </h1>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          {canManage && <TabsTrigger value="programs">البرامج</TabsTrigger>}
          {canAssign && <TabsTrigger value="assign">دفع للحلقات</TabsTrigger>}
          <TabsTrigger value="progress">تقدم الحلقات</TabsTrigger>
        </TabsList>

        {/* ============ PROGRAMS TAB ============ */}
        {canManage && (
          <TabsContent value="programs" className="pt-4">
            <div className="grid grid-cols-12 gap-4">
              <Card className="col-span-12 md:col-span-3">
                <CardHeader><CardTitle className="text-base">البرامج</CardTitle></CardHeader>
                <CardContent className="space-y-1">
                  {curricula.length === 0 && <p className="text-sm text-muted-foreground">لا توجد برامج. أضفها من «مناهج التلقين».</p>}
                  {curricula.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedCurriculumId(c.id)}
                      className={`w-full text-right p-2 rounded text-sm flex items-center justify-between ${selectedCurriculumId === c.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                    >
                      <span>{c.name}</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  ))}
                </CardContent>
              </Card>

              <Card className="col-span-12 md:col-span-9">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="text-base">الأبواب والدروس</CardTitle>
                  <Button size="sm" onClick={openNewChapter} disabled={!selectedCurriculumId}>
                    <Plus className="w-4 h-4 ml-1" /> إضافة باب
                  </Button>
                </CardHeader>
                <CardContent>
                  {chapters.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">لا توجد أبواب بعد.</p>
                  ) : (
                    <Accordion type="multiple" className="w-full">
                      {chapters.map((ch) => (
                        <AccordionItem key={ch.id} value={ch.id}>
                          <AccordionTrigger className="text-sm">
                            <div className="flex items-center gap-2 flex-1">
                              <Badge variant="outline">باب {ch.chapter_number}</Badge>
                              <span className="font-medium">{ch.title}</span>
                              <Badge variant="secondary" className="text-[10px]">{ch.grade_group}</Badge>
                              <span className="text-xs text-muted-foreground mr-auto">
                                {(lessonsByChapter[ch.id] || []).length} درس
                              </span>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="space-y-2">
                              <div className="flex justify-end gap-2">
                                <Button size="sm" variant="outline" onClick={() => openEditChapter(ch)}><Pencil className="w-3 h-3 ml-1" />تعديل</Button>
                                <Button size="sm" variant="destructive" onClick={() => deleteChapter(ch.id)}><Trash2 className="w-3 h-3 ml-1" />حذف</Button>
                                <Button size="sm" onClick={() => openNewLesson(ch.id)}><Plus className="w-3 h-3 ml-1" />درس</Button>
                              </div>
                              {(lessonsByChapter[ch.id] || []).length === 0 ? (
                                <p className="text-xs text-muted-foreground text-center py-3">لا توجد دروس</p>
                              ) : (
                                <div className="space-y-1">
                                  {(lessonsByChapter[ch.id] || []).map((l) => (
                                    <div key={l.id} className="flex items-center gap-2 p-2 border rounded text-sm">
                                      {lessonTypeIcon(l.lesson_type)}
                                      <span className="flex-1">{l.lesson_number}. {l.title}</span>
                                      <Badge variant="outline" className="text-[10px]">{lessonTypeLabel(l.lesson_type)}</Badge>
                                      <Button size="sm" variant="ghost" onClick={() => setViewerLesson(l)}><Eye className="w-3 h-3" /></Button>
                                      <Button size="sm" variant="ghost" onClick={() => openEditLesson(l)}><Pencil className="w-3 h-3" /></Button>
                                      <Button size="sm" variant="ghost" onClick={() => deleteLesson(l.id)}><Trash2 className="w-3 h-3 text-destructive" /></Button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}

        {/* ============ ASSIGN TAB ============ */}
        {canAssign && (
          <TabsContent value="assign" className="pt-4">
            <div className="grid grid-cols-12 gap-4">
              <Card className="col-span-12 md:col-span-3">
                <CardHeader><CardTitle className="text-base">حلقات التلقين</CardTitle></CardHeader>
                <CardContent className="space-y-1">
                  {talqeenHalaqat.map((h) => (
                    <button
                      key={h.id}
                      onClick={() => setSelectedHalaqaId(h.id)}
                      className={`w-full text-right p-2 rounded text-sm ${selectedHalaqaId === h.id ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
                    >{h.name}</button>
                  ))}
                </CardContent>
              </Card>

              <Card className="col-span-12 md:col-span-9">
                <CardHeader><CardTitle className="text-base">البرامج المُسنَدة</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {!selectedHalaqaId ? (
                    <p className="text-sm text-muted-foreground text-center py-6">اختر حلقة لعرض البرامج.</p>
                  ) : (
                    <>
                      <div className="space-y-2">
                        {assignments.filter((a) => a.is_active).length === 0 && (
                          <p className="text-xs text-muted-foreground">لا توجد برامج مُسنَدة لهذه الحلقة.</p>
                        )}
                        {assignments.filter((a) => a.is_active).map((a) => (
                          <div key={a.id} className="flex items-center justify-between p-3 border rounded">
                            <div>
                              <p className="font-medium text-sm">{a.talqeen_curricula?.name}</p>
                              {a.start_date && <p className="text-xs text-muted-foreground">يبدأ: {a.start_date}</p>}
                            </div>
                            <Button size="sm" variant="destructive" onClick={() => unassign(a.id)}>
                              <X className="w-3 h-3 ml-1" />إلغاء الإسناد
                            </Button>
                          </div>
                        ))}
                      </div>

                      <div className="border-t pt-4 space-y-2">
                        <Label>إسناد برنامج جديد</Label>
                        <div className="flex gap-2 flex-wrap">
                          <Select value={assignCurriculum} onValueChange={setAssignCurriculum}>
                            <SelectTrigger className="flex-1 min-w-[200px]"><SelectValue placeholder="اختر برنامجاً" /></SelectTrigger>
                            <SelectContent>
                              {curricula.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <Input type="date" value={assignStartDate} onChange={(e) => setAssignStartDate(e.target.value)} className="w-44" />
                          <Button onClick={assignProgram}><Send className="w-4 h-4 ml-1" />إسناد</Button>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        )}

        {/* ============ PROGRESS TAB ============ */}
        <TabsContent value="progress" className="pt-4">
          <Card>
            <CardHeader><CardTitle className="text-base">تقدم الحلقات في برامج التلقين</CardTitle></CardHeader>
            <CardContent>
              {progressRows.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">لا توجد إسنادات نشطة.</p>
              ) : (
                <div className="space-y-3">
                  {progressRows.map((r) => {
                    const pct = r.total ? Math.round((r.completed / r.total) * 100) : 0;
                    const color = pct >= 75 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500";
                    return (
                      <div key={r.id} className="border rounded p-3 space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <div>
                            <span className="font-medium">{r.halaqat?.name || "—"}</span>
                            <span className="text-muted-foreground"> • {r.talqeen_curricula?.name}</span>
                          </div>
                          <Badge variant="outline">{r.completed} / {r.total}</Badge>
                        </div>
                        <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                          <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ===== Chapter Dialog ===== */}
      <Dialog open={chapterDialog} onOpenChange={setChapterDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingChapter ? "تعديل باب" : "إضافة باب"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>رقم الباب</Label><Input type="number" value={chapterForm.chapter_number} onChange={(e) => setChapterForm({ ...chapterForm, chapter_number: Number(e.target.value) })} /></div>
            <div><Label>العنوان</Label><Input value={chapterForm.title} onChange={(e) => setChapterForm({ ...chapterForm, title: e.target.value })} /></div>
            <div>
              <Label>الفئة العمرية</Label>
              <Select value={chapterForm.grade_group} onValueChange={(v) => setChapterForm({ ...chapterForm, grade_group: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{GRADE_GROUPS.map((g) => <SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>الوصف</Label><Textarea rows={3} value={chapterForm.description} onChange={(e) => setChapterForm({ ...chapterForm, description: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={saveChapter}>حفظ</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== Lesson Dialog ===== */}
      <Dialog open={lessonDialog} onOpenChange={setLessonDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editingLesson ? "تعديل درس" : "إضافة درس"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>رقم الدرس</Label><Input type="number" value={lessonForm.lesson_number} onChange={(e) => setLessonForm({ ...lessonForm, lesson_number: e.target.value })} /></div>
              <div><Label>المدة (دقائق)</Label><Input type="number" value={lessonForm.estimated_duration_minutes} onChange={(e) => setLessonForm({ ...lessonForm, estimated_duration_minutes: e.target.value })} /></div>
            </div>
            <div><Label>العنوان</Label><Input value={lessonForm.title} onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })} /></div>
            <div>
              <Label>نوع الدرس</Label>
              <RadioGroup value={lessonForm.lesson_type} onValueChange={(v) => setLessonForm({ ...lessonForm, lesson_type: v })} className="grid grid-cols-2 gap-2 pt-1">
                {LESSON_TYPES.map((t) => (
                  <label key={t.value} className="flex items-center gap-2 border rounded p-2 cursor-pointer">
                    <RadioGroupItem value={t.value} /> <span className="text-sm">{t.label}</span>
                  </label>
                ))}
              </RadioGroup>
            </div>
            {lessonForm.lesson_type === "manual" && (
              <div><Label>المحتوى النصي</Label><Textarea rows={6} value={lessonForm.content} onChange={(e) => setLessonForm({ ...lessonForm, content: e.target.value })} /></div>
            )}
            {lessonForm.lesson_type === "pdf" && (
              <div><Label>رابط ملف PDF</Label><Input value={lessonForm.pdf_url} onChange={(e) => setLessonForm({ ...lessonForm, pdf_url: e.target.value })} dir="ltr" /></div>
            )}
            {lessonForm.lesson_type === "audio" && (
              <div><Label>رابط الصوت</Label><Input value={lessonForm.audio_url} onChange={(e) => setLessonForm({ ...lessonForm, audio_url: e.target.value })} dir="ltr" /></div>
            )}
            {lessonForm.lesson_type === "video" && (
              <div><Label>رابط الفيديو (YouTube)</Label><Input value={lessonForm.video_url} onChange={(e) => setLessonForm({ ...lessonForm, video_url: e.target.value })} dir="ltr" /></div>
            )}
            <div><Label>ملاحظات</Label><Textarea rows={2} value={lessonForm.notes} onChange={(e) => setLessonForm({ ...lessonForm, notes: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={saveLesson}>حفظ</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <ContentViewer lesson={viewerLesson} open={!!viewerLesson} onOpenChange={(o) => { if (!o) setViewerLesson(null); }} />
    </div>
  );
};

export default TalqeenPrograms;
