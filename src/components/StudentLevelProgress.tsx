import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { GraduationCap, Pencil, ChevronLeft, Repeat, PauseCircle, History } from "lucide-react";
import { formatHijriArabic } from "@/lib/hijri";
import { toast } from "sonner";

interface Props {
  studentId: string;
  isManager: boolean;
}

const levelColors: Record<number, string> = {
  1: "bg-emerald-500/10 text-emerald-700 border-emerald-200",
  2: "bg-blue-500/10 text-blue-700 border-blue-200",
  3: "bg-amber-500/10 text-amber-700 border-amber-200",
  4: "bg-purple-500/10 text-purple-700 border-purple-200",
  5: "bg-rose-500/10 text-rose-700 border-rose-200",
};

const KIND_LABELS: Record<string, string> = { annual: "سنوي", continuous: "مستمر" };
const STATUS_LABELS: Record<string, string> = {
  active: "نشط",
  suspended: "موقوف",
  completed: "مكتمل",
};

const today = () => new Date().toISOString().split("T")[0];

const StudentLevelProgress = ({ studentId, isManager }: Props) => {
  const [studentLevel, setStudentLevel] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [tracks, setTracks] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [parts, setParts] = useState<any[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [mode, setMode] = useState<"edit" | "replace">("edit");
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    level_track_id: "",
    branch_id: "",
    part_number: 1,
    track_kind: "continuous",
    academic_year: "",
    start_date: today(),
    end_date: "",
    notes: "",
    suspend_reason: "",
  });
  const [loaded, setLoaded] = useState(false);

  const fetchData = async () => {
    const [slRes, tracksRes, branchesRes, partsRes] = await Promise.all([
      supabase
        .from("student_levels")
        .select("*")
        .eq("student_id", studentId)
        .order("start_date", { ascending: false }),
      supabase.from("level_tracks").select("*").eq("active", true).order("sort_order"),
      supabase.from("level_branches").select("*").order("sort_order"),
      supabase.from("level_parts").select("*").order("sort_order"),
    ]);
    const rows = (slRes.data as any[]) || [];
    setStudentLevel(rows.find((r) => r.status === "active") || null);
    setHistory(rows.filter((r) => r.status !== "active"));
    setTracks(tracksRes.data || []);
    setBranches(branchesRes.data || []);
    setParts(partsRes.data || []);
    setLoaded(true);
  };

  useEffect(() => { fetchData(); }, [studentId]);

  const currentTrack = tracks.find((t) => t.id === studentLevel?.level_track_id);
  const currentBranch = branches.find((b) => b.id === studentLevel?.branch_id);
  const trackBranches = branches.filter((b) => b.level_track_id === studentLevel?.level_track_id);
  const totalPartsInLevel = parts.filter((p) => p.level_track_id === studentLevel?.level_track_id).length;

  const completedPartsInLevel = (() => {
    if (!studentLevel || !currentBranch) return 0;
    let completed = 0;
    const sortedBranches = [...trackBranches].sort((a, b) => a.sort_order - b.sort_order);
    for (const b of sortedBranches) {
      if (b.sort_order < currentBranch.sort_order) {
        completed += parts.filter((p) => p.branch_id === b.id).length;
      } else if (b.id === currentBranch.id) {
        completed += (studentLevel.part_number || 1) - 1;
      }
    }
    return completed;
  })();

  const progressPct = totalPartsInLevel > 0 ? Math.round((completedPartsInLevel / totalPartsInLevel) * 100) : 0;
  const nextTrack = tracks.find((t) => t.sort_order === (currentTrack?.sort_order || 0) + 1);
  const remainingParts = totalPartsInLevel - completedPartsInLevel;

  const filteredBranches = branches.filter((b) => b.level_track_id === editForm.level_track_id);
  const filteredParts = parts.filter((p) => p.branch_id === editForm.branch_id);

  const openEdit = (nextMode: "edit" | "replace") => {
    setMode(nextMode);
    if (nextMode === "replace") {
      const firstTrack = tracks[0]?.id || "";
      const firstBranch = branches.find((b) => b.level_track_id === firstTrack);
      setEditForm({
        level_track_id: firstTrack,
        branch_id: firstBranch?.id || "",
        part_number: 1,
        track_kind: "annual",
        academic_year: "",
        start_date: today(),
        end_date: "",
        notes: "",
        suspend_reason: "",
      });
    } else {
      setEditForm({
        level_track_id: studentLevel?.level_track_id || tracks[0]?.id || "",
        branch_id: studentLevel?.branch_id || "",
        part_number: studentLevel?.part_number || 1,
        track_kind: studentLevel?.track_kind || "continuous",
        academic_year: studentLevel?.academic_year || "",
        start_date: studentLevel?.start_date || today(),
        end_date: studentLevel?.end_date || "",
        notes: studentLevel?.notes || "",
        suspend_reason: "",
      });
    }
    setEditOpen(true);
  };

  const handleSuspend = async () => {
    if (!studentLevel) return;
    const { error } = await supabase
      .from("student_levels")
      .update({ status: "suspended", end_date: today(), suspend_reason: "إيقاف يدوي" })
      .eq("id", studentLevel.id);
    if (error) { toast.error("تعذّر إيقاف المسار"); return; }
    toast.success("تم إيقاف مسار الحفظ الحالي");
    fetchData();
  };

  const handleSaveLevel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.level_track_id) return;
    setSaving(true);

    const payload: any = {
      student_id: studentId,
      level_track_id: editForm.level_track_id,
      branch_id: editForm.branch_id || null,
      part_number: editForm.part_number || 1,
      track_kind: editForm.track_kind,
      academic_year: editForm.academic_year || null,
      start_date: editForm.start_date || today(),
      end_date: editForm.end_date || null,
      notes: editForm.notes || null,
      status: "active",
      updated_by_manager: true,
    };

    if (mode === "edit" && studentLevel) {
      const { error } = await supabase.from("student_levels").update(payload).eq("id", studentLevel.id);
      setSaving(false);
      if (error) { toast.error("حدث خطأ أثناء التحديث"); return; }
      toast.success("تم تحديث مسار الحفظ");
    } else {
      // إيقاف المسار السابق أولاً ثم اعتماد المسار الجديد
      if (studentLevel) {
        const { error: suspErr } = await supabase
          .from("student_levels")
          .update({
            status: "suspended",
            end_date: today(),
            suspend_reason: editForm.suspend_reason || "استبدال بمسار جديد",
          })
          .eq("id", studentLevel.id);
        if (suspErr) { setSaving(false); toast.error("تعذّر إيقاف المسار السابق"); return; }
      }
      const { error } = await supabase.from("student_levels").insert({ ...payload, progress_percentage: 0 });
      setSaving(false);
      if (error) { toast.error("حدث خطأ أثناء اعتماد المسار الجديد"); return; }
      toast.success("تم اعتماد مسار الحفظ الجديد");
    }

    setEditOpen(false);
    fetchData();
  };

  if (!loaded) return null;

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between gap-2 flex-wrap">
            <span className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-primary" />
              مسار الحفظ
            </span>
            {isManager && studentLevel && (
              <span className="flex items-center gap-1">
                <Button variant="ghost" size="sm" onClick={() => openEdit("edit")}>
                  <Pencil className="w-3 h-3 ml-1" />
                  تعديل
                </Button>
                <Button variant="ghost" size="sm" onClick={() => openEdit("replace")}>
                  <Repeat className="w-3 h-3 ml-1" />
                  استبدال
                </Button>
                <Button variant="ghost" size="sm" onClick={handleSuspend}>
                  <PauseCircle className="w-3 h-3 ml-1" />
                  إيقاف
                </Button>
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!studentLevel ? (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">لا يوجد مسار حفظ نشط لهذا الطالب</p>
              {isManager && (
                <Button variant="outline" size="sm" className="mt-2" onClick={() => openEdit("replace")}>
                  اعتماد مسار حفظ
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary">{KIND_LABELS[studentLevel.track_kind] || "مستمر"}</Badge>
                <Badge variant="outline">{STATUS_LABELS[studentLevel.status] || studentLevel.status}</Badge>
                {studentLevel.academic_year && (
                  <Badge variant="outline">{studentLevel.academic_year}</Badge>
                )}
                <span className="text-xs text-muted-foreground">
                  بداية: {formatHijriArabic(studentLevel.start_date)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">المستوى الحالي</p>
                  <Badge variant="outline" className={levelColors[currentTrack?.level_number || 1]}>
                    {currentTrack?.name || "—"}
                  </Badge>
                </div>
                <div className="space-y-1 text-left">
                  <p className="text-sm text-muted-foreground">الفرع</p>
                  <p className="font-medium text-sm">{currentBranch ? `الفرع ${currentBranch.branch_number}` : "—"}</p>
                </div>
                <div className="space-y-1 text-left">
                  <p className="text-sm text-muted-foreground">الجزء</p>
                  <p className="font-medium text-sm">{studentLevel.part_number || 1}</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">نسبة الإنجاز في المستوى</span>
                  <span className="font-bold text-primary">{progressPct}%</span>
                </div>
                <Progress value={progressPct} className="h-3" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">الأجزاء المتبقية</p>
                  <p className="text-lg font-bold">{remainingParts}</p>
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">المستوى التالي</p>
                  <p className="text-sm font-bold flex items-center gap-1">
                    {nextTrack ? (
                      <>
                        <ChevronLeft className="w-3 h-3" />
                        {nextTrack.name}
                      </>
                    ) : "مكتمل ✓"}
                  </p>
                </div>
              </div>
            </>
          )}

          {history.length > 0 && (
            <div className="pt-2 border-t space-y-2">
              <p className="text-sm font-medium flex items-center gap-2">
                <History className="w-4 h-4 text-muted-foreground" />
                المسارات السابقة
              </p>
              {history.map((h) => {
                const t = tracks.find((x) => x.id === h.level_track_id);
                return (
                  <div key={h.id} className="flex items-center justify-between text-xs bg-muted/40 rounded-md p-2 gap-2">
                    <span className="font-medium">{t?.name || "—"} • جزء {h.part_number}</span>
                    <span className="text-muted-foreground">
                      {formatHijriArabic(h.start_date)} — {h.end_date ? formatHijriArabic(h.end_date) : "—"}
                    </span>
                    <Badge variant="outline">{STATUS_LABELS[h.status] || h.status}</Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{mode === "edit" ? "تعديل مسار الحفظ" : "اعتماد مسار حفظ جديد"}</DialogTitle>
            <DialogDescription>
              {mode === "edit"
                ? "تعديل بيانات المسار النشط الحالي."
                : "سيتم إيقاف المسار السابق (إن وجد) وحفظه في السجل، ثم اعتماد المسار الجديد."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveLevel} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>نوع المسار</Label>
                <Select
                  value={editForm.track_kind}
                  onValueChange={(v) => setEditForm({ ...editForm, track_kind: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="annual">سنوي</SelectItem>
                    <SelectItem value="continuous">مستمر</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>العام الدراسي</Label>
                <Input
                  value={editForm.academic_year}
                  onChange={(e) => setEditForm({ ...editForm, academic_year: e.target.value })}
                  placeholder="1447هـ"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>المستوى</Label>
              <Select
                value={editForm.level_track_id}
                onValueChange={(v) => {
                  const firstBranch = branches.find((b) => b.level_track_id === v);
                  setEditForm({ ...editForm, level_track_id: v, branch_id: firstBranch?.id || "", part_number: 1 });
                }}
              >
                <SelectTrigger><SelectValue placeholder="اختر المستوى" /></SelectTrigger>
                <SelectContent>
                  {tracks.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>الفرع</Label>
              <Select
                value={editForm.branch_id}
                onValueChange={(v) => setEditForm({ ...editForm, branch_id: v, part_number: 1 })}
              >
                <SelectTrigger><SelectValue placeholder="اختر الفرع" /></SelectTrigger>
                <SelectContent>
                  {filteredBranches.map((b) => (
                    <SelectItem key={b.id} value={b.id}>الفرع {b.branch_number}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>رقم الجزء</Label>
              <Select
                value={String(editForm.part_number)}
                onValueChange={(v) => setEditForm({ ...editForm, part_number: Number(v) })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {filteredParts.map((p) => (
                    <SelectItem key={p.id} value={String(p.part_number)}>الجزء {p.part_number}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>تاريخ البداية</Label>
                <Input
                  type="date"
                  value={editForm.start_date}
                  onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>تاريخ النهاية (اختياري)</Label>
                <Input
                  type="date"
                  value={editForm.end_date}
                  onChange={(e) => setEditForm({ ...editForm, end_date: e.target.value })}
                />
              </div>
            </div>

            {mode === "replace" && studentLevel && (
              <div className="space-y-2">
                <Label>سبب استبدال المسار السابق</Label>
                <Input
                  value={editForm.suspend_reason}
                  onChange={(e) => setEditForm({ ...editForm, suspend_reason: e.target.value })}
                  placeholder="مثال: إتمام المستوى / تغيير المنهج"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>ملاحظات</Label>
              <Textarea
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                rows={2}
              />
            </div>

            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? "جارٍ الحفظ..." : mode === "edit" ? "حفظ التعديلات" : "اعتماد المسار الجديد"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default StudentLevelProgress;
