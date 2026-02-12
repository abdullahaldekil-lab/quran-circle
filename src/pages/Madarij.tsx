import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, BookOpen, Users, CheckCircle, Eye } from "lucide-react";
import { useRole } from "@/hooks/useRole";
import { toast } from "sonner";

const Madarij = () => {
  const { isManager } = useRole();
  const navigate = useNavigate();
  const [tracks, setTracks] = useState<any[]>([]);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [trackDialogOpen, setTrackDialogOpen] = useState(false);
  const [editingTrack, setEditingTrack] = useState<any>(null);
  const [deleteTrackId, setDeleteTrackId] = useState<string | null>(null);
  const [trackForm, setTrackForm] = useState({ name: "", description: "", days_required: 20 });

  const fetchData = async () => {
    setLoading(true);
    const [tracksRes, enrollRes] = await Promise.all([
      supabase.from("madarij_tracks").select("*").eq("active", true).order("created_at"),
      supabase.from("madarij_enrollments").select("*, students(full_name, halaqat(name)), madarij_tracks(name)").order("created_at", { ascending: false }).limit(50),
    ]);
    setTracks(tracksRes.data || []);
    setEnrollments(enrollRes.data || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const openNewTrack = () => {
    setEditingTrack(null);
    setTrackForm({ name: "", description: "", days_required: 20 });
    setTrackDialogOpen(true);
  };

  const openEditTrack = (track: any) => {
    setEditingTrack(track);
    setTrackForm({ name: track.name, description: track.description || "", days_required: track.days_required });
    setTrackDialogOpen(true);
  };

  const handleSaveTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingTrack) {
      const { error } = await supabase.from("madarij_tracks").update(trackForm).eq("id", editingTrack.id);
      if (error) { toast.error("خطأ في التعديل"); return; }
      toast.success("تم تعديل المسار");
    } else {
      const { error } = await supabase.from("madarij_tracks").insert(trackForm);
      if (error) { toast.error("خطأ في الإضافة"); return; }
      toast.success("تم إضافة المسار");
    }
    setTrackDialogOpen(false);
    fetchData();
  };

  const handleDeleteTrack = async () => {
    if (!deleteTrackId) return;
    const { error } = await supabase.from("madarij_tracks").update({ active: false }).eq("id", deleteTrackId);
    if (error) { toast.error("خطأ في الحذف"); return; }
    toast.success("تم حذف المسار");
    setDeleteTrackId(null);
    fetchData();
  };

  const activeEnrollments = enrollments.filter(e => e.status === "active").length;
  const completedEnrollments = enrollments.filter(e => e.status === "completed").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">برنامج مدارج</h1>
          <p className="text-sm text-muted-foreground">طريقك نحو إتقان القرآن الكريم</p>
        </div>
        {isManager && (
          <Button onClick={openNewTrack}>
            <Plus className="w-4 h-4 ml-1" />
            إضافة مسار
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{tracks.length}</p>
              <p className="text-xs text-muted-foreground">مسارات نشطة</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{activeEnrollments}</p>
              <p className="text-xs text-muted-foreground">تسجيلات نشطة</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{completedEnrollments}</p>
              <p className="text-xs text-muted-foreground">تسجيلات مكتملة</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tracks Cards */}
      <div>
        <h2 className="text-lg font-semibold mb-3">المسارات</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {tracks.map((track) => (
            <Card key={track.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{track.name}</CardTitle>
                  {isManager && (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditTrack(track)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteTrackId(track.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
                <CardDescription className="text-xs">{track.description}</CardDescription>
              </CardHeader>
              <CardContent>
                <Badge variant="secondary">{track.days_required} يوم</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Recent Enrollments */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">آخر التسجيلات</CardTitle>
        </CardHeader>
        <CardContent>
          {enrollments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">لا توجد تسجيلات بعد</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الطالب</TableHead>
                  <TableHead>المسار</TableHead>
                  <TableHead>الجزء</TableHead>
                  <TableHead>الحزب</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>عرض</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {enrollments.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{(e.students as any)?.full_name}</TableCell>
                    <TableCell>{(e.madarij_tracks as any)?.name}</TableCell>
                    <TableCell>{e.part_number}</TableCell>
                    <TableCell>{e.hizb_number}</TableCell>
                    <TableCell>
                      <Badge variant={e.status === "active" ? "default" : "secondary"}>
                        {e.status === "active" ? "نشط" : "مكتمل"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(`/madarij/${e.id}`)}>
                        <Eye className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Track Dialog */}
      <Dialog open={trackDialogOpen} onOpenChange={setTrackDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingTrack ? "تعديل المسار" : "إضافة مسار جديد"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSaveTrack} className="space-y-4">
            <div className="space-y-2">
              <Label>اسم المسار</Label>
              <Input value={trackForm.name} onChange={(e) => setTrackForm({ ...trackForm, name: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>الوصف</Label>
              <Input value={trackForm.description} onChange={(e) => setTrackForm({ ...trackForm, description: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>عدد الأيام</Label>
              <Input type="number" value={trackForm.days_required} onChange={(e) => setTrackForm({ ...trackForm, days_required: Number(e.target.value) })} required />
            </div>
            <Button type="submit" className="w-full">{editingTrack ? "حفظ التعديلات" : "إضافة"}</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Track Confirmation */}
      <AlertDialog open={!!deleteTrackId} onOpenChange={() => setDeleteTrackId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>هل أنت متأكد من حذف هذا المسار؟</AlertDialogTitle>
            <AlertDialogDescription>سيتم تعطيل المسار. يمكن استعادته لاحقاً.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTrack} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Madarij;
