import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { GraduationCap, BookOpen, Target, RefreshCw, Pencil } from "lucide-react";
import { useRole } from "@/hooks/useRole";
import { toast } from "sonner";

const Levels = () => {
  const { isManager } = useRole();
  const [levels, setLevels] = useState<any[]>([]);
  const [madarijTracks, setMadarijTracks] = useState<any[]>([]);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ id: "", name: "", description: "", target_memorization: "", daily_target: "", review_requirement: "", suitable_for: "", madarij_track_id: "" });

  const fetchData = async () => {
    const [levelsRes, tracksRes] = await Promise.all([
      supabase.from("memorization_levels").select("*").eq("active", true).order("sort_order"),
      supabase.from("madarij_tracks").select("id, name").eq("active", true),
    ]);
    setLevels(levelsRes.data || []);
    setMadarijTracks(tracksRes.data || []);
  };

  useEffect(() => { fetchData(); }, []);

  const openEdit = (level: any) => {
    setEditForm({
      id: level.id, name: level.name || "", description: level.description || "",
      target_memorization: level.target_memorization || "", daily_target: level.daily_target || "",
      review_requirement: level.review_requirement || "", suitable_for: level.suitable_for || "",
      madarij_track_id: level.madarij_track_id || "",
    });
    setEditOpen(true);
  };

  const handleSave = async () => {
    const { id, ...updates } = editForm;
    const { error } = await supabase.from("memorization_levels").update(updates as any).eq("id", id);
    if (error) { toast.error("خطأ في الحفظ"); return; }
    toast.success("تم التعديل بنجاح");
    setEditOpen(false);
    fetchData();
  };

  const levelColors = [
    "bg-emerald-500/10 text-emerald-700 border-emerald-200",
    "bg-blue-500/10 text-blue-700 border-blue-200",
    "bg-amber-500/10 text-amber-700 border-amber-200",
    "bg-purple-500/10 text-purple-700 border-purple-200",
    "bg-rose-500/10 text-rose-700 border-rose-200",
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">مستويات الحفظ</h1>
        <p className="text-muted-foreground text-sm">المستويات المعتمدة لتنظيم الطلاب وتحديد أهداف الحفظ اليومية</p>
      </div>

      <div className="grid gap-4">
        {levels.map((level, i) => (
          <Card key={level.id} className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-primary" />
                  {level.name}
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={levelColors[i % levelColors.length]}>
                    المستوى {level.sort_order}
                  </Badge>
                  {isManager && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(level)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{level.description}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-start gap-2 bg-muted/50 rounded-lg p-3">
                  <Target className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">نطاق الحفظ</p>
                    <p className="text-sm font-medium">{level.target_memorization}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 bg-muted/50 rounded-lg p-3">
                  <BookOpen className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">الحفظ اليومي</p>
                    <p className="text-sm font-medium">{level.daily_target}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 bg-muted/50 rounded-lg p-3">
                  <RefreshCw className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">المراجعة</p>
                    <p className="text-sm font-medium">{level.review_requirement}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 bg-muted/50 rounded-lg p-3">
                  <GraduationCap className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">مناسب لـ</p>
                    <p className="text-sm font-medium">{level.suitable_for}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>تعديل المستوى</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>اسم المستوى</Label><Input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div><Label>الوصف</Label><Textarea value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} /></div>
            <div><Label>نطاق الحفظ</Label><Input value={editForm.target_memorization} onChange={e => setEditForm(f => ({ ...f, target_memorization: e.target.value }))} /></div>
            <div><Label>الحفظ اليومي</Label><Input value={editForm.daily_target} onChange={e => setEditForm(f => ({ ...f, daily_target: e.target.value }))} /></div>
            <div><Label>المراجعة</Label><Input value={editForm.review_requirement} onChange={e => setEditForm(f => ({ ...f, review_requirement: e.target.value }))} /></div>
            <div><Label>مناسب لـ</Label><Input value={editForm.suitable_for} onChange={e => setEditForm(f => ({ ...f, suitable_for: e.target.value }))} /></div>
            <div>
              <Label>المسار المرتبط في مدارج</Label>
              <Select value={editForm.madarij_track_id} onValueChange={v => setEditForm(f => ({ ...f, madarij_track_id: v }))}>
                <SelectTrigger><SelectValue placeholder="اختر مسار..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">بدون ربط</SelectItem>
                  {madarijTracks.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>إلغاء</Button>
            <Button onClick={handleSave}>حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Levels;
