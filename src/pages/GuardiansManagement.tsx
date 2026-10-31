import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Link2, Unlink, UserPlus, Save, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useRole } from "@/hooks/useRole";
import { normalizeWhatsappNumber } from "@/lib/whatsapp";

type Guardian = { id: string; full_name: string; phone: string | null; approval_status: string };
type Link = { id: string; guardian_id: string; student_id: string; relationship: string | null; active: boolean };
type Student = { id: string; full_name: string; guardian_name: string | null; guardian_phone: string | null; guardian_work: string | null; halaqa_id: string | null };

const RELATIONS = ["أب", "أم", "أخ", "جد", "عم", "خال", "أخرى"];
const STATUS: Record<string, string> = { approved: "معتمد", pending: "بانتظار الاعتماد", rejected: "مرفوض" };

const StudentPicker = ({ students, value, onChange }: { students: Student[]; value: string; onChange: (v: string) => void }) => {
  const [q, setQ] = useState("");
  const list = students.filter((s) => !q || s.full_name.includes(q)).slice(0, 50);
  return (
    <div className="space-y-2">
      <Input placeholder="ابحث باسم الطالب" value={q} onChange={(e) => setQ(e.target.value)} />
      <Select value={value} onValueChange={onChange}><SelectTrigger><SelectValue placeholder="اختر الطالب" /></SelectTrigger>
        <SelectContent>{list.map((s) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}</SelectContent></Select>
    </div>
  );
};

const GuardiansManagement = () => {
  const { role } = useRole();
  const isManager = role === "manager";
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [search, setSearch] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [edits, setEdits] = useState<Record<string, Partial<Student>>>({});

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ full_name: "", phone: "", email: "", student_id: "", relationship: "أب" });
  const [creating, setCreating] = useState(false);
  const [tempPass, setTempPass] = useState<string | null>(null);

  const [linkFor, setLinkFor] = useState<Guardian | null>(null);
  const [linkStudent, setLinkStudent] = useState("");
  const [linkRel, setLinkRel] = useState("أب");
  const [editG, setEditG] = useState<Guardian | null>(null);

  const load = async () => {
    const [{ data: g }, { data: l }, { data: s }] = await Promise.all([
      supabase.from("guardian_profiles").select("id, full_name, phone, approval_status").order("full_name"),
      supabase.from("guardian_students").select("id, guardian_id, student_id, relationship, active").eq("active", true),
      supabase.from("students").select("id, full_name, guardian_name, guardian_phone, guardian_work, halaqa_id").in("status", ["active", "inactive"]).order("full_name"),
    ]);
    setGuardians(g || []); setLinks(l || []); setStudents((s as Student[]) || []);
  };
  useEffect(() => { load(); }, []);

  const studentName = (id: string) => students.find((s) => s.id === id)?.full_name || "—";

  /** يملأ بيانات ولي الأمر في ملف الطالب (المستخدمة في ناظم) إذا كانت فارغة. */
  const syncToStudent = async (studentId: string, name: string, phone: string | null) => {
    const st = students.find((s) => s.id === studentId);
    if (!st) return;
    const upd: Record<string, string> = {};
    if (!st.guardian_name && name) upd.guardian_name = name;
    if (!st.guardian_phone && phone) upd.guardian_phone = phone;
    if (Object.keys(upd).length) await supabase.from("students").update(upd).eq("id", studentId);
  };

  const linkStudentTo = async (g: { id: string; full_name: string; phone: string | null }, studentId: string, rel: string) => {
    const existing = await supabase.from("guardian_students").select("id").eq("guardian_id", g.id).eq("student_id", studentId).maybeSingle();
    const { error } = existing.data
      ? await supabase.from("guardian_students").update({ active: true, relationship: rel }).eq("id", existing.data.id)
      : await supabase.from("guardian_students").insert({ guardian_id: g.id, student_id: studentId, relationship: rel, active: true });
    if (error) throw error;
    await syncToStudent(studentId, g.full_name, g.phone);
  };

  const createGuardian = async () => {
    const phone = form.phone.trim();
    if (!form.full_name.trim() || !phone) return toast.error("الاسم والجوال مطلوبان");
    if (!normalizeWhatsappNumber(phone)) return toast.error("رقم الجوال غير صحيح");
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-users", { body: { action: "create_guardian", full_name: form.full_name.trim(), phone, email: form.email.trim() || undefined } });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      const id = data.user_id as string;
      await supabase.functions.invoke("manage-users", { body: { action: "approve_guardian", guardian_id: id, approved: true } });
      await supabase.from("guardian_profiles").update({ full_name: form.full_name.trim(), phone }).eq("id", id);
      if (form.student_id) await linkStudentTo({ id, full_name: form.full_name.trim(), phone }, form.student_id, form.relationship);
      setTempPass(data.temp_password);
      toast.success("تمت إضافة ولي الأمر واعتماده");
      setForm({ full_name: "", phone: "", email: "", student_id: "", relationship: "أب" });
      load();
    } catch (e: any) {
      toast.error("تعذرت الإضافة: " + (String(e?.message || "").includes("already") ? "يوجد حساب بنفس البريد أو الجوال" : e?.message));
    }
    setCreating(false);
  };

  const doLink = async () => {
    if (!linkFor || !linkStudent) return toast.error("اختر الطالب");
    try { await linkStudentTo(linkFor, linkStudent, linkRel); toast.success("تم ربط الطالب"); setLinkFor(null); setLinkStudent(""); load(); }
    catch (e: any) { toast.error("تعذر الربط: " + e.message); }
  };

  const unlink = async (l: Link) => {
    const { error } = await supabase.from("guardian_students").update({ active: false }).eq("id", l.id);
    if (error) return toast.error("تعذر فك الربط");
    toast.success("تم فك الربط"); load();
  };

  const saveGuardian = async () => {
    if (!editG) return;
    if (editG.phone && !normalizeWhatsappNumber(editG.phone)) return toast.error("رقم الجوال غير صحيح");
    const { error } = await supabase.from("guardian_profiles").update({ full_name: editG.full_name, phone: editG.phone }).eq("id", editG.id);
    if (error) return toast.error("تعذر الحفظ");
    // تحديث جوال/اسم ولي الأمر في ملفات أبنائه المرتبطين
    const kids = links.filter((l) => l.guardian_id === editG.id).map((l) => l.student_id);
    if (kids.length) await supabase.from("students").update({ guardian_name: editG.full_name, guardian_phone: editG.phone }).in("id", kids);
    toast.success("تم تحديث بيانات التواصل" + (kids.length ? ` وملفات ${kids.length} طالب` : ""));
    setEditG(null); load();
  };

  const approve = async (g: Guardian) => {
    const { data, error } = await supabase.functions.invoke("manage-users", { body: { action: "approve_guardian", guardian_id: g.id, approved: true } });
    if (error || data?.error) return toast.error("تعذر الاعتماد");
    toast.success("تم الاعتماد"); load();
  };

  const saveStudent = async (s: Student) => {
    const e = edits[s.id]; if (!e) return;
    if (e.guardian_phone && !normalizeWhatsappNumber(e.guardian_phone)) return toast.error("رقم الجوال غير صحيح");
    const { error } = await supabase.from("students").update(e).eq("id", s.id);
    if (error) return toast.error("تعذر الحفظ");
    setStudents((l) => l.map((x) => x.id === s.id ? { ...x, ...e } : x));
    setEdits((m) => { const n = { ...m }; delete n[s.id]; return n; });
    toast.success(`تم حفظ بيانات ولي أمر ${s.full_name}`);
  };

  const shownGuardians = useMemo(() => guardians.filter((g) => !search || g.full_name.includes(search) || (g.phone || "").includes(search)), [guardians, search]);
  const shownStudents = useMemo(() => students.filter((s) => !studentSearch || s.full_name.includes(studentSearch) || (s.guardian_phone || "").includes(studentSearch)).slice(0, 20), [students, studentSearch]);
  const val = (s: Student, k: "guardian_name" | "guardian_phone" | "guardian_work") => (edits[s.id]?.[k] ?? s[k] ?? "") as string;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">إدارة أولياء الأمور</h1>
          <p className="text-muted-foreground">إضافة أولياء الأمور، ربطهم بالطلاب، وتحديث بيانات التواصل</p>
        </div>
        {isManager && <Button onClick={() => { setTempPass(null); setAddOpen(true); }}><UserPlus className="w-4 h-4 ml-2" />إضافة ولي أمر</Button>}
      </div>

      <Tabs defaultValue="accounts">
        <TabsList><TabsTrigger value="accounts">حسابات أولياء الأمور ({guardians.length})</TabsTrigger><TabsTrigger value="contacts">بيانات التواصل في ملفات الطلاب</TabsTrigger></TabsList>

        <TabsContent value="accounts" className="space-y-4">
          <Input placeholder="بحث بالاسم أو الجوال" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
          {shownGuardians.length === 0 ? <p className="text-muted-foreground">لا يوجد أولياء أمور.</p> : (
            <div className="grid gap-4 md:grid-cols-2">
              {shownGuardians.map((g) => {
                const kids = links.filter((l) => l.guardian_id === g.id);
                return (
                  <Card key={g.id}>
                    <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
                      <div><CardTitle className="text-base">{g.full_name}</CardTitle><p className="text-sm text-muted-foreground" dir="ltr">{g.phone || "بدون جوال"}</p></div>
                      <Badge variant={g.approval_status === "approved" ? "secondary" : "outline"}>{STATUS[g.approval_status] || g.approval_status}</Badge>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {kids.length === 0 ? <p className="text-sm text-muted-foreground">غير مرتبط بأي طالب</p> : (
                        <ul className="space-y-1">{kids.map((l) => (
                          <li key={l.id} className="flex items-center justify-between text-sm bg-muted rounded px-2 py-1">
                            <span>{studentName(l.student_id)} <span className="text-muted-foreground">({l.relationship || "—"})</span></span>
                            <Button size="sm" variant="ghost" onClick={() => unlink(l)}><Unlink className="w-3 h-3 ml-1" />فك</Button>
                          </li>))}</ul>)}
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" onClick={() => { setLinkFor(g); setLinkStudent(""); }}><Link2 className="w-4 h-4 ml-1" />ربط بطالب</Button>
                        <Button size="sm" variant="outline" onClick={() => setEditG({ ...g })}><Pencil className="w-4 h-4 ml-1" />تعديل التواصل</Button>
                        {isManager && g.approval_status !== "approved" && <Button size="sm" onClick={() => approve(g)}>اعتماد</Button>}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>)}
        </TabsContent>

        <TabsContent value="contacts" className="space-y-4">
          <Input placeholder="بحث باسم الطالب أو جوال ولي الأمر" value={studentSearch} onChange={(e) => setStudentSearch(e.target.value)} className="max-w-sm" />
          <Card><CardContent className="pt-4"><Table>
            <TableHeader><TableRow><TableHead className="text-right">الطالب</TableHead><TableHead className="text-right">اسم ولي الأمر</TableHead><TableHead className="text-right">الجوال</TableHead><TableHead className="text-right">العمل</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>{shownStudents.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="font-medium">{s.full_name}</TableCell>
                {(["guardian_name", "guardian_phone", "guardian_work"] as const).map((k) => (
                  <TableCell key={k}><Input value={val(s, k)} dir={k === "guardian_phone" ? "ltr" : "rtl"} className={!val(s, k) ? "border-destructive" : ""}
                    onChange={(e) => setEdits((m) => ({ ...m, [s.id]: { ...m[s.id], [k]: e.target.value } }))} /></TableCell>
                ))}
                <TableCell><Button size="sm" disabled={!edits[s.id]} onClick={() => saveStudent(s)}><Save className="w-4 h-4 ml-1" />حفظ</Button></TableCell>
              </TableRow>))}
            </TableBody></Table>
            <p className="text-xs text-muted-foreground mt-2">تظهر أول 20 نتيجة — استخدم البحث للوصول لطالب محدد. هذه البيانات هي المستخدمة في تصدير ناظم.</p>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>إضافة ولي أمر جديد</DialogTitle></DialogHeader>
          {tempPass ? (
            <div className="space-y-2">
              <p>تم إنشاء الحساب. كلمة المرور المؤقتة (أرسلها لولي الأمر):</p>
              <p className="font-mono text-lg bg-muted rounded p-2 text-center" dir="ltr">{tempPass}</p>
              <DialogFooter><Button onClick={() => setAddOpen(false)}>تم</Button></DialogFooter>
            </div>
          ) : (
            <div className="space-y-3">
              <div><Label>الاسم *</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
              <div><Label>الجوال *</Label><Input dir="ltr" placeholder="05xxxxxxxx" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label>البريد (اختياري)</Label><Input dir="ltr" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label>ربط بطالب (اختياري)</Label><StudentPicker students={students} value={form.student_id} onChange={(v) => setForm({ ...form, student_id: v })} /></div>
              <div><Label>صلة القرابة</Label><Select value={form.relationship} onValueChange={(v) => setForm({ ...form, relationship: v })}><SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{RELATIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select></div>
              <DialogFooter><Button onClick={createGuardian} disabled={creating}>{creating ? "جارٍ الإضافة..." : "إضافة"}</Button></DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!linkFor} onOpenChange={(o) => !o && setLinkFor(null)}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>ربط {linkFor?.full_name} بطالب</DialogTitle></DialogHeader>
          <StudentPicker students={students} value={linkStudent} onChange={setLinkStudent} />
          <Select value={linkRel} onValueChange={setLinkRel}><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{RELATIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent></Select>
          <DialogFooter><Button onClick={doLink}>ربط</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editG} onOpenChange={(o) => !o && setEditG(null)}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>تعديل بيانات التواصل</DialogTitle></DialogHeader>
          {editG && <div className="space-y-3">
            <div><Label>الاسم</Label><Input value={editG.full_name} onChange={(e) => setEditG({ ...editG, full_name: e.target.value })} /></div>
            <div><Label>الجوال</Label><Input dir="ltr" value={editG.phone || ""} onChange={(e) => setEditG({ ...editG, phone: e.target.value })} /></div>
            <p className="text-xs text-muted-foreground">سيُحدَّث الاسم والجوال أيضًا في ملفات الأبناء المرتبطين.</p>
          </div>}
          <DialogFooter><Button onClick={saveGuardian}>حفظ</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default GuardiansManagement;
