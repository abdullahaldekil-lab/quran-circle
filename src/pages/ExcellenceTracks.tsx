import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Edit, ArrowRight, Users } from "lucide-react";

interface Track {
  id: string;
  track_name: string;
  description: string | null;
  criteria: any;
  is_active: boolean;
  created_at: string;
  student_count?: number;
}

export default function ExcellenceTracks() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isManager } = useRole();
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);
  const [form, setForm] = useState({ track_name: "", description: "", criteria: "{}" });

  useEffect(() => {
    fetchTracks();
  }, []);

  const fetchTracks = async () => {
    setLoading(true);
    const { data: tracksData } = await supabase
      .from("excellence_tracks")
      .select("*")
      .order("created_at", { ascending: false });

    // Get student counts per track
    const { data: counts } = await supabase
      .from("distinguished_students")
      .select("track_id");

    const countMap: Record<string, number> = {};
    (counts || []).forEach((c: any) => {
      countMap[c.track_id] = (countMap[c.track_id] || 0) + 1;
    });

    setTracks(
      (tracksData || []).map((t: any) => ({
        ...t,
        student_count: countMap[t.id] || 0,
      }))
    );
    setLoading(false);
  };

  const openAdd = () => {
    setEditingTrack(null);
    setForm({ track_name: "", description: "", criteria: "{}" });
    setDialogOpen(true);
  };

  const openEdit = (track: Track) => {
    setEditingTrack(track);
    setForm({
      track_name: track.track_name,
      description: track.description || "",
      criteria: JSON.stringify(track.criteria || {}, null, 2),
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.track_name.trim()) {
      toast.error("اسم المسار مطلوب");
      return;
    }

    let parsedCriteria = {};
    try {
      parsedCriteria = JSON.parse(form.criteria || "{}");
    } catch {
      toast.error("صيغة المعايير غير صحيحة (JSON)");
      return;
    }

    if (editingTrack) {
      const { error } = await supabase
        .from("excellence_tracks")
        .update({
          track_name: form.track_name,
          description: form.description || null,
          criteria: parsedCriteria,
        })
        .eq("id", editingTrack.id);
      if (error) toast.error("خطأ: " + error.message);
      else toast.success("تم تعديل المسار");
    } else {
      const { error } = await supabase.from("excellence_tracks").insert({
        track_name: form.track_name,
        description: form.description || null,
        criteria: parsedCriteria,
        created_by: user?.id,
      });
      if (error) toast.error("خطأ: " + error.message);
      else toast.success("تم إضافة المسار");
    }

    setDialogOpen(false);
    fetchTracks();
  };

  const toggleActive = async (track: Track) => {
    const { error } = await supabase
      .from("excellence_tracks")
      .update({ is_active: !track.is_active })
      .eq("id", track.id);
    if (error) toast.error("خطأ: " + error.message);
    else {
      toast.success(track.is_active ? "تم تعطيل المسار" : "تم تفعيل المسار");
      fetchTracks();
    }
  };

  if (!isManager) {
    return <p className="text-center text-muted-foreground py-12">هذه الصفحة متاحة للمدير فقط.</p>;
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/excellence")}>
            <ArrowRight className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">إدارة مسارات التميّز</h1>
            <p className="text-muted-foreground text-sm">إنشاء وتعديل مسارات التميّز</p>
          </div>
        </div>
        <Button onClick={openAdd}>
          <Plus className="w-4 h-4 ml-2" />
          مسار جديد
        </Button>
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground py-8">جارٍ التحميل...</p>
      ) : tracks.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12 text-muted-foreground">
            لا توجد مسارات بعد. أضف مسار تميّز جديد.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">اسم المسار</TableHead>
                  <TableHead className="text-right">الوصف</TableHead>
                  <TableHead className="text-center">الطلاب</TableHead>
                  <TableHead className="text-center">الحالة</TableHead>
                  <TableHead className="text-center">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tracks.map((track) => (
                  <TableRow key={track.id}>
                    <TableCell className="font-semibold">{track.track_name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-xs truncate">
                      {track.description || "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="gap-1">
                        <Users className="w-3 h-3" />
                        {track.student_count}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={track.is_active}
                        onCheckedChange={() => toggleActive(track)}
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(track)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTrack ? "تعديل المسار" : "إضافة مسار جديد"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">اسم المسار</label>
              <Input
                value={form.track_name}
                onChange={(e) => setForm({ ...form, track_name: e.target.value })}
                placeholder="مثال: مسار النخبة"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">الوصف</label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="وصف المسار..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">المعايير (JSON)</label>
              <Textarea
                value={form.criteria}
                onChange={(e) => setForm({ ...form, criteria: e.target.value })}
                className="font-mono text-sm"
                rows={4}
                dir="ltr"
              />
            </div>
            <Button className="w-full" onClick={handleSave}>
              {editingTrack ? "حفظ التعديلات" : "إضافة المسار"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
