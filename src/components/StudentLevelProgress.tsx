import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GraduationCap, TrendingUp, Pencil, ChevronLeft } from "lucide-react";
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

const StudentLevelProgress = ({ studentId, isManager }: Props) => {
  const [studentLevel, setStudentLevel] = useState<any>(null);
  const [tracks, setTracks] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [parts, setParts] = useState<any[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ level_track_id: "", branch_id: "", part_number: 1 });
  const [loaded, setLoaded] = useState(false);

  const fetchData = async () => {
    const [slRes, tracksRes, branchesRes, partsRes] = await Promise.all([
      supabase.from("student_levels").select("*").eq("student_id", studentId).maybeSingle(),
      supabase.from("level_tracks").select("*").eq("active", true).order("sort_order"),
      supabase.from("level_branches").select("*").order("sort_order"),
      supabase.from("level_parts").select("*").order("sort_order"),
    ]);
    setStudentLevel(slRes.data);
    setTracks(tracksRes.data || []);
    setBranches(branchesRes.data || []);
    setParts(partsRes.data || []);
    setLoaded(true);
  };

  useEffect(() => { fetchData(); }, [studentId]);

  const currentTrack = tracks.find((t) => t.id === studentLevel?.level_track_id);
  const currentBranch = branches.find((b) => b.id === studentLevel?.branch_id);
  const trackBranches = branches.filter((b) => b.level_track_id === studentLevel?.level_track_id);
  const branchParts = parts.filter((p) => p.branch_id === studentLevel?.branch_id);
  const totalPartsInLevel = parts.filter((p) => p.level_track_id === studentLevel?.level_track_id).length;

  // Calculate completed parts in current level
  const completedPartsInLevel = (() => {
    if (!studentLevel || !currentBranch) return 0;
    let completed = 0;
    const sortedBranches = trackBranches.sort((a, b) => a.sort_order - b.sort_order);
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

  // Next level info
  const nextTrack = tracks.find((t) => t.sort_order === (currentTrack?.sort_order || 0) + 1);
  const remainingParts = totalPartsInLevel - completedPartsInLevel;

  const filteredBranches = branches.filter((b) => b.level_track_id === editForm.level_track_id);
  const filteredParts = parts.filter((p) => p.branch_id === editForm.branch_id);

  const openEdit = () => {
    setEditForm({
      level_track_id: studentLevel?.level_track_id || tracks[0]?.id || "",
      branch_id: studentLevel?.branch_id || "",
      part_number: studentLevel?.part_number || 1,
    });
    setEditOpen(true);
  };

  const handleSaveLevel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.level_track_id) return;

    const payload = {
      student_id: studentId,
      level_track_id: editForm.level_track_id,
      branch_id: editForm.branch_id || null,
      part_number: editForm.part_number || 1,
      updated_by_manager: true,
      progress_percentage: 0,
    };

    if (studentLevel) {
      const { error } = await supabase.from("student_levels").update(payload).eq("id", studentLevel.id);
      if (error) { toast.error("حدث خطأ أثناء التحديث"); return; }
    } else {
      const { error } = await supabase.from("student_levels").insert(payload);
      if (error) { toast.error("حدث خطأ أثناء الحفظ"); return; }
    }
    toast.success("تم تحديث مستوى الطالب");
    setEditOpen(false);
    fetchData();
  };

  if (!loaded) return null;

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center justify-between">
            <span className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-primary" />
              مسار الحفظ
            </span>
            {isManager && (
              <Button variant="ghost" size="sm" onClick={openEdit}>
                <Pencil className="w-3 h-3 ml-1" />
                تعديل
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!studentLevel ? (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">لم يتم تحديد مسار حفظ لهذا الطالب</p>
              {isManager && (
                <Button variant="outline" size="sm" className="mt-2" onClick={openEdit}>
                  تحديد المسار
                </Button>
              )}
            </div>
          ) : (
            <>
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
        </CardContent>
      </Card>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>تعديل مسار الحفظ</DialogTitle></DialogHeader>
          <form onSubmit={handleSaveLevel} className="space-y-4">
            <div className="space-y-2">
              <Label>المستوى</Label>
              <Select
                value={editForm.level_track_id}
                onValueChange={(v) => {
                  const firstBranch = branches.find((b) => b.level_track_id === v);
                  setEditForm({ level_track_id: v, branch_id: firstBranch?.id || "", part_number: 1 });
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
            <Button type="submit" className="w-full">حفظ المستوى</Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default StudentLevelProgress;
