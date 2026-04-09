import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Eye, BookOpen, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  studentId: string;
  isManager: boolean;
}

const MadarijStudentSection = ({ studentId, isManager }: Props) => {
  const navigate = useNavigate();
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [tracks, setTracks] = useState<any[]>([]);
  const [levelTracks, setLevelTracks] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    track_id: "", level_track_id: "", branch_id: "", part_number: 1, hizb_number: 1,
    start_date: new Date().toISOString().split("T")[0], end_date: "",
  });

  const hasActiveEnrollment = enrollments.some(e => e.status === "active");

  const fetchEnrollments = async () => {
    const { data } = await supabase
      .from("madarij_enrollments")
      .select("*, madarij_tracks!madarij_enrollments_track_id_fkey(name, days_required)")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false });
    setEnrollments(data || []);
  };

  const fetchMeta = async () => {
    const [tRes, ltRes, bRes] = await Promise.all([
      supabase.from("madarij_tracks").select("*").eq("active", true),
      supabase.from("level_tracks").select("*").eq("active", true).order("sort_order"),
      supabase.from("level_branches").select("*").order("sort_order"),
    ]);
    setTracks(tRes.data || []);
    setLevelTracks(ltRes.data || []);
    setBranches(bRes.data || []);
  };

  useEffect(() => {
    fetchEnrollments();
    fetchMeta();
  }, [studentId]);

  const openNewDialog = () => {
    if (hasActiveEnrollment) {
      toast.error("لا يمكن تسجيل الطالب في أكثر من مسار نشط في نفس الوقت");
      return;
    }
    setEditingId(null);
    setForm({
      track_id: "", level_track_id: "", branch_id: "", part_number: 1, hizb_number: 1,
      start_date: new Date().toISOString().split("T")[0], end_date: "",
    });
    setDialogOpen(true);
  };

  const openEditDialog = (en: any) => {
    setEditingId(en.id);
    setForm({
      track_id: en.track_id,
      level_track_id: en.level_track_id || "",
      branch_id: en.branch_id || "",
      part_number: en.part_number,
      hizb_number: en.hizb_number,
      start_date: en.start_date,
      end_date: en.end_date || "",
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const selectedTrack = tracks.find(t => t.id === form.track_id);
    const endDate = form.end_date || (selectedTrack ? (() => {
      const d = new Date(form.start_date);
      d.setDate(d.getDate() + selectedTrack.days_required);
      return d.toISOString().split("T")[0];
    })() : null);

    if (editingId) {
      const { error } = await supabase.from("madarij_enrollments").update({
        track_id: form.track_id,
        level_track_id: form.level_track_id || null,
        branch_id: form.branch_id || null,
        part_number: form.part_number,
        hizb_number: form.hizb_number,
        start_date: form.start_date,
        end_date: endDate,
      }).eq("id", editingId);

      if (error) { toast.error("خطأ في تحديث التسجيل"); return; }
      toast.success("تم تحديث التسجيل بنجاح");
    } else {
      // Double-check no active enrollment exists
      const { data: existing } = await supabase
        .from("madarij_enrollments")
        .select("id")
        .eq("student_id", studentId)
        .eq("status", "active")
        .limit(1);

      if (existing && existing.length > 0) {
        toast.error("الطالب مسجل بالفعل في مسار نشط. يرجى إنهاء المسار الحالي أولاً");
        return;
      }

      const { error } = await supabase.from("madarij_enrollments").insert({
        student_id: studentId,
        track_id: form.track_id,
        level_track_id: form.level_track_id || null,
        branch_id: form.branch_id || null,
        part_number: form.part_number,
        hizb_number: form.hizb_number,
        start_date: form.start_date,
        end_date: endDate,
      });

      if (error) { toast.error("خطأ في التسجيل"); return; }
      toast.success("تم التسجيل في برنامج مدارج");
    }

    setDialogOpen(false);
    setEditingId(null);
    fetchEnrollments();
  };

  const filteredBranches = form.level_track_id
    ? branches.filter(b => b.level_track_id === form.level_track_id)
    : [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary" />
          برنامج مدارج
        </CardTitle>
        {isManager && (
          <Button size="sm" onClick={openNewDialog} disabled={hasActiveEnrollment}>
            <Plus className="w-4 h-4 ml-1" />
            تسجيل جديد
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {hasActiveEnrollment && isManager && (
          <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 rounded p-2 mb-3">
            ⚠️ الطالب مسجل في مسار نشط حالياً. لا يمكن التسجيل في مسار آخر حتى يكتمل الحالي.
          </p>
        )}
        {enrollments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">لا يوجد تسجيل في برنامج مدارج</p>
        ) : (
          <div className="space-y-3">
            {enrollments.map((en) => (
              <div key={en.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="text-sm font-medium">{(en.madarij_tracks as any)?.name} — الجزء {en.part_number} / الحزب {en.hizb_number}</p>
                  <p className="text-xs text-muted-foreground">{en.start_date} → {en.end_date || "—"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={en.status === "active" ? "default" : "secondary"} className="text-xs">
                    {en.status === "active" ? "نشط" : "مكتمل"}
                  </Badge>
                  {isManager && en.status === "active" && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDialog(en)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(`/madarij/${en.id}`)}>
                    <Eye className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) setEditingId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "تعديل التسجيل" : "تسجيل جديد في برنامج مدارج"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1">
              <Label>المسار</Label>
              <Select value={form.track_id} onValueChange={v => setForm({...form, track_id: v})} required>
                <SelectTrigger><SelectValue placeholder="اختر المسار" /></SelectTrigger>
                <SelectContent>
                  {tracks.map(t => <SelectItem key={t.id} value={t.id}>{t.name} ({t.days_required} يوم)</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>المستوى</Label>
              <Select value={form.level_track_id} onValueChange={v => setForm({...form, level_track_id: v, branch_id: ""})}>
                <SelectTrigger><SelectValue placeholder="اختر المستوى" /></SelectTrigger>
                <SelectContent>
                  {levelTracks.map(lt => <SelectItem key={lt.id} value={lt.id}>{lt.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {filteredBranches.length > 0 && (
              <div className="space-y-1">
                <Label>الفرع</Label>
                <Select value={form.branch_id} onValueChange={v => setForm({...form, branch_id: v})}>
                  <SelectTrigger><SelectValue placeholder="اختر الفرع" /></SelectTrigger>
                  <SelectContent>
                    {filteredBranches.map(b => <SelectItem key={b.id} value={b.id}>الفرع {b.branch_number}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>الجزء</Label><Input type="number" min={1} max={30} value={form.part_number} onChange={e => setForm({...form, part_number: Number(e.target.value)})} /></div>
              <div className="space-y-1"><Label>الحزب</Label><Input type="number" min={1} max={60} value={form.hizb_number} onChange={e => setForm({...form, hizb_number: Number(e.target.value)})} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label>تاريخ البداية</Label><Input type="date" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} required /></div>
              <div className="space-y-1"><Label>تاريخ النهاية (اختياري)</Label><Input type="date" value={form.end_date} onChange={e => setForm({...form, end_date: e.target.value})} /></div>
            </div>
            <Button type="submit" className="w-full">{editingId ? "حفظ التعديلات" : "تسجيل"}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default MadarijStudentSection;
