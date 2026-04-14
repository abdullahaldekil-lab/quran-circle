import { useState, useEffect, useCallback } from "react";
import StudentNameLink from "@/components/StudentNameLink";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, ArrowRight, Search, Trash2, ArrowLeftRight, Star, Users } from "lucide-react";
import { formatDateSmart } from "@/lib/hijri";
import { sendNotification } from "@/utils/sendNotification";

interface Track {
  id: string;
  track_name: string;
  is_active: boolean;
}

interface DistinguishedStudent {
  id: string;
  student_id: string;
  track_id: string;
  is_star: boolean;
  date_added: string;
  notes: string | null;
  student_name?: string;
  track_name?: string;
}

export default function DistinguishedStudents() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isManager, isTeacher } = useRole();
  const canManage = isManager || isTeacher;

  const [tracks, setTracks] = useState<Track[]>([]);
  const [distinguished, setDistinguished] = useState<DistinguishedStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTrack, setFilterTrack] = useState("all");
  const [search, setSearch] = useState("");

  // Add dialog
  const [addOpen, setAddOpen] = useState(false);
  const [allStudents, setAllStudents] = useState<{ id: string; full_name: string }[]>([]);
  const [addStudentId, setAddStudentId] = useState("");
  const [addTrackId, setAddTrackId] = useState("");
  const [studentSearch, setStudentSearch] = useState("");

  // Transfer dialog
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferRecord, setTransferRecord] = useState<DistinguishedStudent | null>(null);
  const [transferTrackId, setTransferTrackId] = useState("");

  useEffect(() => {
    fetchTracks();
  }, []);

  useEffect(() => {
    fetchDistinguished();
  }, [filterTrack, search]);

  const fetchTracks = async () => {
    const { data } = await supabase
      .from("excellence_tracks")
      .select("id, track_name, is_active")
      .eq("is_active", true)
      .order("track_name");
    setTracks(data || []);
  };

  const fetchDistinguished = async () => {
    setLoading(true);
    let query = supabase
      .from("distinguished_students")
      .select("*, students:student_id(full_name), excellence_tracks:track_id(track_name)")
      .order("date_added", { ascending: false });

    if (filterTrack !== "all") {
      query = query.eq("track_id", filterTrack);
    }

    const { data } = await query;
    let results = (data || []).map((d: any) => ({
      ...d,
      student_name: d.students?.full_name || "—",
      track_name: d.excellence_tracks?.track_name || "—",
    }));

    if (search) {
      results = results.filter((r: any) =>
        r.student_name.toLowerCase().includes(search.toLowerCase())
      );
    }

    setDistinguished(results);
    setLoading(false);
  };

  const openAddDialog = async () => {
    const { data } = await (supabase
      .from("students")
      .select("id, full_name") as any)
      .eq("status", "active")
      .order("full_name");
    setAllStudents(data || []);
    setAddStudentId("");
    setAddTrackId(tracks[0]?.id || "");
    setStudentSearch("");
    setAddOpen(true);
  };

  const handleAdd = async () => {
    if (!addStudentId || !addTrackId) {
      toast.error("اختر الطالب والمسار");
      return;
    }

    // Check duplicate
    const { data: existing } = await supabase
      .from("distinguished_students")
      .select("id")
      .eq("student_id", addStudentId)
      .eq("track_id", addTrackId)
      .maybeSingle();

    if (existing) {
      toast.error("هذا الطالب مسجل مسبقًا في مسار التميّز.");
      return;
    }

    const { error } = await supabase.from("distinguished_students").insert({
      student_id: addStudentId,
      track_id: addTrackId,
      added_by: user?.id,
      is_star: true,
    });

    if (error) {
      toast.error("خطأ: " + error.message);
      return;
    }

    toast.success("تم إضافة الطالب لمسار التميّز");

    // Check if auto_notify_parent is enabled
    const { data: settings } = await supabase
      .from("excellence_track_settings")
      .select("auto_notify_parent")
      .eq("track_id", addTrackId)
      .maybeSingle();

    if (settings?.auto_notify_parent) {
      const { data: guardians } = await supabase
        .from("guardian_students")
        .select("guardian_id")
        .eq("student_id", addStudentId)
        .eq("active", true);

      if (guardians && guardians.length > 0) {
        const recipientIds = guardians.map((g: any) => g.guardian_id);
        await sendNotification({
          templateCode: "excellence_enrollment",
          recipientIds,
          variables: { student_name: allStudents.find(s => s.id === addStudentId)?.full_name || "" },
        });
      }
    }

    setAddOpen(false);
    fetchDistinguished();
  };

  const handleRemove = async (record: DistinguishedStudent) => {
    const { error } = await supabase
      .from("distinguished_students")
      .delete()
      .eq("id", record.id);

    if (error) {
      toast.error("خطأ: " + error.message);
      return;
    }
    toast.success("تم إزالة الطالب من مسار التميّز");
    fetchDistinguished();
  };

  const openTransfer = (record: DistinguishedStudent) => {
    setTransferRecord(record);
    setTransferTrackId("");
    setTransferOpen(true);
  };

  const handleTransfer = async () => {
    if (!transferRecord || !transferTrackId) return;

    // Check duplicate in new track
    const { data: existing } = await supabase
      .from("distinguished_students")
      .select("id")
      .eq("student_id", transferRecord.student_id)
      .eq("track_id", transferTrackId)
      .maybeSingle();

    if (existing) {
      toast.error("الطالب مسجل مسبقًا في المسار الجديد.");
      return;
    }

    const { error } = await supabase
      .from("distinguished_students")
      .update({ track_id: transferTrackId })
      .eq("id", transferRecord.id);

    if (error) {
      toast.error("خطأ: " + error.message);
      return;
    }
    toast.success("تم نقل الطالب للمسار الجديد");
    setTransferOpen(false);
    fetchDistinguished();
  };

  const filteredStudentsForAdd = studentSearch
    ? allStudents.filter((s) => s.full_name.includes(studentSearch))
    : allStudents;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/excellence")}>
            <ArrowRight className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">الطلاب المميزون</h1>
            <p className="text-muted-foreground text-sm">{distinguished.length} طالب مميز</p>
          </div>
        </div>
        {canManage && (
          <Button onClick={openAddDialog}>
            <Plus className="w-4 h-4 ml-2" />
            إضافة طالب
          </Button>
        )}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="بحث بالاسم..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-10"
          />
        </div>
        <Select value={filterTrack} onValueChange={setFilterTrack}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder="كل المسارات" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل المسارات</SelectItem>
            {tracks.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.track_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <p className="text-center text-muted-foreground py-8">جارٍ التحميل...</p>
      ) : distinguished.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12 text-muted-foreground">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>لا يوجد طلاب مميزون</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الطالب</TableHead>
                  <TableHead className="text-right">المسار</TableHead>
                  <TableHead className="text-center">تاريخ الانضمام</TableHead>
                  <TableHead className="text-center">نجمة</TableHead>
                  {canManage && <TableHead className="text-center">إجراءات</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {distinguished.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-semibold"><StudentNameLink studentId={d.student_id} studentName={d.student_name} /></TableCell>
                    <TableCell>
                      <Badge variant="outline">{d.track_name}</Badge>
                    </TableCell>
                    <TableCell className="text-center text-sm text-muted-foreground">
                      {formatDateSmart(d.date_added)}
                    </TableCell>
                    <TableCell className="text-center">
                      {d.is_star && <Star className="w-4 h-4 fill-amber-400 text-amber-400 mx-auto" />}
                    </TableCell>
                    {canManage && (
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openTransfer(d)}
                            title="نقل لمسار آخر"
                          >
                            <ArrowLeftRight className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemove(d)}
                            className="text-destructive hover:text-destructive"
                            title="إزالة"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Add Student Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle>إضافة طالب مميز</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">المسار</label>
              <Select value={addTrackId} onValueChange={setAddTrackId}>
                <SelectTrigger><SelectValue placeholder="اختر المسار" /></SelectTrigger>
                <SelectContent>
                  {tracks.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.track_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">بحث عن طالب</label>
              <Input
                placeholder="اكتب اسم الطالب..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">اختر الطالب</label>
              <Select value={addStudentId} onValueChange={setAddStudentId}>
                <SelectTrigger><SelectValue placeholder="اختر طالب" /></SelectTrigger>
                <SelectContent>
                  {filteredStudentsForAdd.slice(0, 50).map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={handleAdd}>إضافة</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Transfer Dialog */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle>نقل الطالب لمسار آخر</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              نقل <strong>{transferRecord?.student_name}</strong> من{" "}
              <strong>{transferRecord?.track_name}</strong> إلى:
            </p>
            <Select value={transferTrackId} onValueChange={setTransferTrackId}>
              <SelectTrigger><SelectValue placeholder="اختر المسار الجديد" /></SelectTrigger>
              <SelectContent>
                {tracks
                  .filter((t) => t.id !== transferRecord?.track_id)
                  .map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.track_name}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Button className="w-full" onClick={handleTransfer}>نقل</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
