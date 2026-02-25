import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { useTeacherHalaqat } from "@/hooks/useTeacherHalaqat";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Calendar, Users, BookOpen, Trophy } from "lucide-react";
import { format } from "date-fns";

interface Session {
  id: string;
  session_date: string;
  halaqa_id: string | null;
  notes: string | null;
  total_hizb_in_session: number;
  total_pages_displayed: number;
  created_at: string;
  halaqat?: { name: string } | null;
}

function getNextTuesday(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = (2 - day + 7) % 7 || 7;
  d.setDate(d.getDate() + (day === 2 ? 0 : diff));
  return d.toISOString().split("T")[0];
}

export default function Excellence() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isManager, isSupervisor } = useRole();
  const { allowedHalaqatIds, filterHalaqat } = useTeacherHalaqat();

  const [sessions, setSessions] = useState<Session[]>([]);
  const [halaqat, setHalaqat] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [newDate, setNewDate] = useState(getNextTuesday());
  const [newHalaqaId, setNewHalaqaId] = useState("");
  const [newNotes, setNewNotes] = useState("");

  useEffect(() => {
    fetchData();
  }, [allowedHalaqatIds]);

  const fetchData = async () => {
    setLoading(true);
    const [sessRes, halRes] = await Promise.all([
      supabase
        .from("excellence_sessions")
        .select("*, halaqat(name)")
        .order("session_date", { ascending: false })
        .limit(50),
      supabase.from("halaqat").select("id, name").eq("active", true),
    ]);

    const allHalaqat = halRes.data || [];
    const filtered = filterHalaqat(allHalaqat);
    setHalaqat(filtered);

    let sessionsList = sessRes.data || [];
    if (allowedHalaqatIds) {
      sessionsList = sessionsList.filter(
        (s) => s.halaqa_id && allowedHalaqatIds.includes(s.halaqa_id)
      );
    }
    setSessions(sessionsList as Session[]);
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!newHalaqaId) {
      toast.error("اختر الحلقة");
      return;
    }
    const { data, error } = await supabase
      .from("excellence_sessions")
      .insert({
        session_date: newDate,
        halaqa_id: newHalaqaId,
        created_by: user?.id,
        notes: newNotes || null,
      })
      .select()
      .single();

    if (error) {
      toast.error("خطأ في إنشاء الجلسة: " + error.message);
      return;
    }
    toast.success("تم إنشاء الجلسة بنجاح");
    setDialogOpen(false);
    setNewNotes("");
    navigate(`/excellence/${data.id}`);
  };

  const totalHizb = sessions.reduce((s, r) => s + Number(r.total_hizb_in_session || 0), 0);
  const totalPages = sessions.reduce((s, r) => s + Number(r.total_pages_displayed || 0), 0);

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">مسار التميّز</h1>
          <p className="text-muted-foreground text-sm">إدارة جلسات التميّز الأسبوعية</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/excellence/reports")}>
            <Trophy className="w-4 h-4 ml-2" />
            التقارير
          </Button>
          {!isSupervisor && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 ml-2" />
                  جلسة جديدة
                </Button>
              </DialogTrigger>
              <DialogContent dir="rtl">
                <DialogHeader>
                  <DialogTitle>إنشاء جلسة تميّز جديدة</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">تاريخ الجلسة</label>
                    <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">الحلقة</label>
                    <Select value={newHalaqaId} onValueChange={setNewHalaqaId}>
                      <SelectTrigger><SelectValue placeholder="اختر الحلقة" /></SelectTrigger>
                      <SelectContent>
                        {halaqat.map((h) => (
                          <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">ملاحظات</label>
                    <Textarea value={newNotes} onChange={(e) => setNewNotes(e.target.value)} placeholder="ملاحظات اختيارية..." />
                  </div>
                  <Button className="w-full" onClick={handleCreate}>إنشاء الجلسة</Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Calendar className="w-8 h-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{sessions.length}</p>
              <p className="text-sm text-muted-foreground">جلسة</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <BookOpen className="w-8 h-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{totalHizb}</p>
              <p className="text-sm text-muted-foreground">إجمالي الأحزاب</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Users className="w-8 h-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{totalPages}</p>
              <p className="text-sm text-muted-foreground">إجمالي الأوجه</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sessions List */}
      {loading ? (
        <p className="text-center text-muted-foreground py-8">جارٍ التحميل...</p>
      ) : sessions.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Calendar className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground">لا توجد جلسات بعد</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {sessions.map((s) => (
            <Card
              key={s.id}
              className="cursor-pointer hover:border-primary/40 transition-colors"
              onClick={() => navigate(`/excellence/${s.id}`)}
            >
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <div className="bg-primary/10 rounded-lg p-2">
                    <Calendar className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold">
                      {format(new Date(s.session_date), "yyyy/MM/dd")}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {(s as any).halaqat?.name || "—"}
                    </p>
                  </div>
                </div>
                <div className="flex gap-6 text-sm text-muted-foreground">
                  <span>{Number(s.total_hizb_in_session || 0)} حزب</span>
                  <span>{Number(s.total_pages_displayed || 0)} وجه</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
