import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { ArrowLeftRight, Users, UserCheck, Search, AlertTriangle, Loader2 } from "lucide-react";
import { useRole } from "@/hooks/useRole";

interface TeacherRow {
  id: string;
  full_name: string;
  role: string;
  assigned_halaqa_id: string | null;
  assigned_assistant_halaqa_id: string | null;
}

interface HalaqaRow {
  id: string;
  name: string;
  teacher_id: string | null;
  assistant_teacher_id: string | null;
  capacity_max: number;
  location: string | null;
  schedule: string | null;
}

type MoveType = "teacher" | "assistant";

const TeacherManagement = () => {
  const { canWrite } = useRole();
  const canManage = canWrite("halaqat");

  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [halaqat, setHalaqat] = useState<HalaqaRow[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [moveOpen, setMoveOpen] = useState(false);
  const [moveTeacher, setMoveTeacher] = useState<TeacherRow | null>(null);
  const [moveType, setMoveType] = useState<MoveType>("teacher");
  const [targetHalaqaId, setTargetHalaqaId] = useState<string>("__none__");

  const fetchData = async () => {
    setLoading(true);
    const [teachersRes, halaqatRes, studentsRes] = await Promise.all([
      (supabase as any)
        .from("profiles")
        .select("id, full_name, role, assigned_halaqa_id, assigned_assistant_halaqa_id")
        .in("role", ["teacher", "assistant_teacher"])
        .order("full_name"),
      supabase
        .from("halaqat")
        .select("id, name, teacher_id, assistant_teacher_id, capacity_max, location, schedule")
        .eq("active", true)
        .order("name"),
      supabase.from("students").select("id, halaqa_id").eq("status", "active"),
    ]);

    const grouped: Record<string, number> = {};
    (studentsRes.data || []).forEach((s: any) => {
      if (s.halaqa_id) grouped[s.halaqa_id] = (grouped[s.halaqa_id] || 0) + 1;
    });

    setTeachers((teachersRes.data as TeacherRow[]) || []);
    setHalaqat((halaqatRes.data as HalaqaRow[]) || []);
    setCounts(grouped);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const halaqaById = (id?: string | null) => halaqat.find((h) => h.id === id) || null;
  const teacherById = (id?: string | null) => teachers.find((t) => t.id === id) || null;

  const filtered = useMemo(() => {
    const q = search.trim();
    if (!q) return teachers;
    return teachers.filter((t) => (t.full_name || "").includes(q));
  }, [teachers, search]);

  const openMove = (teacher: TeacherRow, type: MoveType) => {
    setMoveTeacher(teacher);
    setMoveType(type);
    const current = type === "teacher" ? teacher.assigned_halaqa_id : teacher.assigned_assistant_halaqa_id;
    setTargetHalaqaId(current || "__none__");
    setMoveOpen(true);
  };

  /** معاينة تفصيلية للتغيير قبل التنفيذ */
  const preview = useMemo(() => {
    if (!moveTeacher) return null;
    const currentId = moveType === "teacher"
      ? moveTeacher.assigned_halaqa_id
      : moveTeacher.assigned_assistant_halaqa_id;
    const target = targetHalaqaId === "__none__" ? null : targetHalaqaId;
    const currentHalaqa = halaqaById(currentId);
    const targetHalaqa = halaqaById(target);
    const occupantId = targetHalaqa
      ? (moveType === "teacher" ? targetHalaqa.teacher_id : targetHalaqa.assistant_teacher_id)
      : null;
    const occupant = occupantId && occupantId !== moveTeacher.id ? teacherById(occupantId) : null;

    return {
      currentHalaqa,
      targetHalaqa,
      occupant,
      noChange: (currentId || null) === target,
      studentsAffected: currentHalaqa ? counts[currentHalaqa.id] || 0 : 0,
      targetStudents: targetHalaqa ? counts[targetHalaqa.id] || 0 : 0,
    };
  }, [moveTeacher, moveType, targetHalaqaId, halaqat, teachers, counts]);

  const applyMove = async () => {
    if (!moveTeacher || !preview) return;
    setSaving(true);
    try {
      const target = targetHalaqaId === "__none__" ? null : targetHalaqaId;
      const halaqaCol = moveType === "teacher" ? "teacher_id" : "assistant_teacher_id";
      const profileCol = moveType === "teacher" ? "assigned_halaqa_id" : "assigned_assistant_halaqa_id";

      // 1) فك ارتباط المعلم من حلقته الحالية
      if (preview.currentHalaqa) {
        const { error } = await supabase
          .from("halaqat")
          .update({ [halaqaCol]: null } as any)
          .eq("id", preview.currentHalaqa.id);
        if (error) throw error;
      }

      // 2) فك ارتباط المعلم الشاغل للحلقة الهدف (إن وجد)
      if (preview.occupant && target) {
        const { error: e1 } = await supabase
          .from("halaqat")
          .update({ [halaqaCol]: null } as any)
          .eq("id", target);
        if (e1) throw e1;
        const { error: e2 } = await supabase
          .from("profiles")
          .update({ [profileCol]: null } as any)
          .eq("id", preview.occupant.id);
        if (e2) throw e2;
      }

      // 3) الربط بالحلقة الجديدة
      if (target) {
        const { error } = await supabase
          .from("halaqat")
          .update({ [halaqaCol]: moveTeacher.id } as any)
          .eq("id", target);
        if (error) throw error;
      }

      // 4) تحديث ملف المعلم
      const { error: pErr } = await supabase
        .from("profiles")
        .update({ [profileCol]: target } as any)
        .eq("id", moveTeacher.id);
      if (pErr) throw pErr;

      toast.success(target ? "تم نقل المعلم بنجاح" : "تم فك ارتباط المعلم بالحلقة");
      setMoveOpen(false);
      setMoveTeacher(null);
      await fetchData();
    } catch (e: any) {
      toast.error("تعذر تنفيذ التغيير: " + (e?.message || "خطأ غير معروف"));
    } finally {
      setSaving(false);
    }
  };

  const unassignedCount = teachers.filter(
    (t) => !t.assigned_halaqa_id && !t.assigned_assistant_halaqa_id
  ).length;

  return (
    <div className="space-y-6" dir="rtl">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">إدارة المعلمين</h1>
          <p className="text-sm text-muted-foreground">
            عرض كل معلم وحلقاته الحالية مع إمكانية نقله بين الحلقات بعد معاينة تفصيلية
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="secondary">إجمالي المعلمين: {teachers.length}</Badge>
          <Badge variant="outline">بدون حلقة: {unassignedCount}</Badge>
        </div>
      </header>

      <div className="relative max-w-sm">
        <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pr-9"
          placeholder="بحث باسم المعلم..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="بحث باسم المعلم"
        />
      </div>

      {!canManage && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>عرض فقط</AlertTitle>
          <AlertDescription>لا تملك صلاحية تعديل ارتباط المعلمين بالحلقات.</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> جاري التحميل...
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((t) => {
            const main = halaqaById(t.assigned_halaqa_id);
            const assist = halaqaById(t.assigned_assistant_halaqa_id);
            return (
              <Card key={t.id}>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between gap-2 text-base">
                    <span>{t.full_name}</span>
                    <Badge variant={t.role === "teacher" ? "default" : "secondary"}>
                      {t.role === "teacher" ? "معلم" : "معلم مساعد"}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <UserCheck className="h-4 w-4 text-muted-foreground" />
                      <span>
                        كمعلم أساسي:{" "}
                        {main ? (
                          <span className="font-medium">
                            {main.name} ({counts[main.id] || 0} طالب)
                          </span>
                        ) : (
                          <span className="text-muted-foreground">غير مرتبط</span>
                        )}
                      </span>
                    </div>
                    {canManage && (
                      <Button size="sm" variant="outline" onClick={() => openMove(t, "teacher")}>
                        <ArrowLeftRight className="ml-1 h-3.5 w-3.5" /> نقل
                      </Button>
                    )}
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>
                        كمعلم مساعد:{" "}
                        {assist ? (
                          <span className="font-medium">
                            {assist.name} ({counts[assist.id] || 0} طالب)
                          </span>
                        ) : (
                          <span className="text-muted-foreground">غير مرتبط</span>
                        )}
                      </span>
                    </div>
                    {canManage && (
                      <Button size="sm" variant="outline" onClick={() => openMove(t, "assistant")}>
                        <ArrowLeftRight className="ml-1 h-3.5 w-3.5" /> نقل
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-muted-foreground">لا يوجد معلمون مطابقون للبحث.</p>
          )}
        </div>
      )}

      <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              نقل {moveTeacher?.full_name} — {moveType === "teacher" ? "معلم أساسي" : "معلم مساعد"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>الحلقة الجديدة</Label>
              <Select value={targetHalaqaId} onValueChange={setTargetHalaqaId}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر الحلقة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">بدون حلقة (فك الارتباط)</SelectItem>
                  {halaqat.map((h) => {
                    const occId = moveType === "teacher" ? h.teacher_id : h.assistant_teacher_id;
                    const occ = teacherById(occId);
                    return (
                      <SelectItem key={h.id} value={h.id}>
                        {h.name} — {occ ? `مشغولة بـ ${occ.full_name}` : "شاغرة"} ({counts[h.id] || 0} طالب)
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {preview && (
              <div className="rounded-lg border p-3 text-sm space-y-2">
                <p className="font-semibold">معاينة التغيير</p>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">الحلقة الحالية</span>
                  <span>{preview.currentHalaqa ? `${preview.currentHalaqa.name} (${preview.studentsAffected} طالب)` : "بدون"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">الحلقة الجديدة</span>
                  <span>{preview.targetHalaqa ? `${preview.targetHalaqa.name} (${preview.targetStudents} طالب)` : "بدون (فك ارتباط)"}</span>
                </div>
                <Separator />
                <ul className="list-disc pr-5 space-y-1 text-muted-foreground">
                  {preview.currentHalaqa && (
                    <li>
                      ستصبح حلقة «{preview.currentHalaqa.name}» بلا {moveType === "teacher" ? "معلم أساسي" : "معلم مساعد"}
                      {preview.studentsAffected > 0 && ` (${preview.studentsAffected} طالب متأثر)`}
                    </li>
                  )}
                  {preview.occupant && (
                    <li className="text-destructive">
                      سيتم فك ارتباط «{preview.occupant.full_name}» من الحلقة الهدف
                    </li>
                  )}
                  {preview.targetHalaqa && (
                    <li>سيتم ربط «{moveTeacher?.full_name}» بحلقة «{preview.targetHalaqa.name}»</li>
                  )}
                  {preview.noChange && <li>لا يوجد تغيير — الحلقة المختارة هي نفس الحالية</li>}
                </ul>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setMoveOpen(false)} disabled={saving}>
              إلغاء
            </Button>
            <Button onClick={applyMove} disabled={saving || !canManage || !!preview?.noChange}>
              {saving && <Loader2 className="ml-1 h-4 w-4 animate-spin" />} تأكيد التغيير
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TeacherManagement;
