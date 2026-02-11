import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowRight, User, Calendar, TrendingUp, Play, BookOpen, Mic, ChevronLeft, ChevronRight } from "lucide-react";
import { formatHijriArabic } from "@/lib/hijri";

const PAGE_SIZE = 20;

const StudentProfile = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [student, setStudent] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [recordsPage, setRecordsPage] = useState(0);
  const [recordsTotal, setRecordsTotal] = useState(0);
  const [attendanceStats, setAttendanceStats] = useState({ present: 0, absent: 0, total: 0 });
  const [activeTab, setActiveTab] = useState("records");

  useEffect(() => {
    if (!id) return;

    const fetchData = async () => {
      const [studentRes, attendanceRes] = await Promise.all([
        supabase.from("students").select("*, halaqat(name)").eq("id", id).maybeSingle(),
        supabase.from("attendance").select("status").eq("student_id", id),
      ]);

      setStudent(studentRes.data);

      const att = attendanceRes.data || [];
      setAttendanceStats({
        present: att.filter((a: any) => a.status === "present").length,
        absent: att.filter((a: any) => a.status === "absent").length,
        total: att.length,
      });
    };
    fetchData();
  }, [id]);

  // Fetch recitation records with pagination
  useEffect(() => {
    if (!id) return;
    const fetchRecords = async () => {
      const { data, count } = await supabase
        .from("recitation_records")
        .select("*", { count: "exact" })
        .eq("student_id", id)
        .order("record_date", { ascending: false })
        .range(recordsPage * PAGE_SIZE, (recordsPage + 1) * PAGE_SIZE - 1);
      setRecords(data || []);
      setRecordsTotal(count || 0);
    };
    fetchRecords();
  }, [id, recordsPage]);

  if (!student) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const avgScore = records.length
    ? Math.round(records.reduce((sum, r) => sum + Number(r.total_score || 0), 0) / records.length)
    : 0;
  const avgMistakes = records.length
    ? Math.round(records.reduce((sum, r) => sum + (r.mistakes_count || 0), 0) / records.length)
    : 0;
  const progressPercent = Math.min(100, Math.round(((student.total_memorized_pages || 0) / 604) * 100));
  const recordsTotalPages = Math.ceil(recordsTotal / PAGE_SIZE);

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl mx-auto">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
        <ArrowRight className="w-4 h-4 ml-1" />
        رجوع
      </Button>

      {/* Student Header */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
              <User className="w-8 h-8 text-primary" />
            </div>
            <div className="flex-1">
              <h1 className="text-xl font-bold">{student.full_name}</h1>
              <p className="text-sm text-muted-foreground">{student.halaqat?.name || "بدون حلقة"}</p>
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="secondary">{student.current_level}</Badge>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  منذ {student.join_date}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Progress */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            تقدم الحفظ
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>{student.total_memorized_pages || 0} صفحة</span>
              <span className="text-muted-foreground">من 604 صفحة</span>
            </div>
            <Progress value={progressPercent} className="h-3" />
            <p className="text-xs text-muted-foreground text-center">{progressPercent}% مكتمل</p>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{avgScore}</p>
            <p className="text-xs text-muted-foreground">متوسط الدرجة</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-destructive">{avgMistakes}</p>
            <p className="text-xs text-muted-foreground">متوسط الأخطاء</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-success">
              {attendanceStats.total ? Math.round((attendanceStats.present / attendanceStats.total) * 100) : 0}%
            </p>
            <p className="text-xs text-muted-foreground">نسبة الحضور</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs: Records vs Audio (lazy-loaded) */}
      <Tabs value={activeTab} onValueChange={setActiveTab} dir="rtl">
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="records">
            <TrendingUp className="w-4 h-4 ml-1" />
            سجل التسميعات
          </TabsTrigger>
          <TabsTrigger value="audio">
            <Mic className="w-4 h-4 ml-1" />
            التسجيلات الصوتية
          </TabsTrigger>
        </TabsList>

        <TabsContent value="records">
          <Card>
            <CardContent className="pt-6">
              {records.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">لا توجد سجلات</p>
              ) : (
                <div className="space-y-3">
                  {records.map((r) => (
                    <div key={r.id} className="flex items-center justify-between py-3 border-b last:border-0">
                      <div className="flex-1">
                        <p className="text-sm font-medium">
                          {r.memorized_from && r.memorized_to
                            ? `${r.memorized_from} → ${r.memorized_to}`
                            : "حفظ"}
                        </p>
                        <p className="text-xs text-muted-foreground">{r.record_date}</p>
                        {r.notes && <p className="text-xs text-muted-foreground mt-1">{r.notes}</p>}
                      </div>
                      <div className={`text-sm font-bold min-w-[2rem] text-left ${
                        Number(r.total_score) >= 80 ? "text-success" : Number(r.total_score) >= 60 ? "text-warning" : "text-destructive"
                      }`}>
                        {r.total_score}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {/* Pagination */}
              {recordsTotalPages > 1 && (
                <div className="flex items-center justify-center gap-4 pt-4">
                  <Button variant="outline" size="sm" disabled={recordsPage <= 0} onClick={() => setRecordsPage(recordsPage - 1)}>
                    <ChevronRight className="w-4 h-4 ml-1" />
                    السابق
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    {recordsPage + 1} / {recordsTotalPages}
                  </span>
                  <Button variant="outline" size="sm" disabled={recordsPage >= recordsTotalPages - 1} onClick={() => setRecordsPage(recordsPage + 1)}>
                    التالي
                    <ChevronLeft className="w-4 h-4 mr-1" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audio">
          <AudioTab studentId={id!} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Lazy-loaded audio tab - only fetches when tab is opened
const AudioTab = ({ studentId }: { studentId: string }) => {
  const [audioRecords, setAudioRecords] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const fetchAudio = async () => {
      const { data } = await supabase
        .from("recitation_records")
        .select("id, record_date, memorized_from, memorized_to, audio_url")
        .eq("student_id", studentId)
        .not("audio_url", "is", null)
        .order("record_date", { ascending: false })
        .limit(50);
      setAudioRecords(data || []);
      setLoaded(true);
    };
    fetchAudio();
  }, [studentId]);

  if (!loaded) {
    return (
      <Card>
        <CardContent className="py-12 flex justify-center">
          <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="pt-6">
        {audioRecords.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">لا توجد تسجيلات صوتية</p>
        ) : (
          <div className="space-y-3">
            {audioRecords.map((r) => (
              <div key={r.id} className="flex items-center justify-between py-3 border-b last:border-0">
                <div>
                  <p className="text-sm font-medium">
                    {r.memorized_from && r.memorized_to ? `${r.memorized_from} → ${r.memorized_to}` : "تسجيل"}
                  </p>
                  <p className="text-xs text-muted-foreground">{r.record_date}</p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => {
                    const audio = new Audio(r.audio_url);
                    audio.play();
                  }}
                >
                  <Play className="w-4 h-4 text-primary" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default StudentProfile;
