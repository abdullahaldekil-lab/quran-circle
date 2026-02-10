import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ArrowRight, User, Calendar, TrendingUp, Play, BookOpen } from "lucide-react";

const StudentProfile = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [student, setStudent] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [attendanceStats, setAttendanceStats] = useState({ present: 0, absent: 0, total: 0 });

  useEffect(() => {
    if (!id) return;

    const fetchData = async () => {
      const [studentRes, recordsRes, attendanceRes] = await Promise.all([
        supabase.from("students").select("*, halaqat(name)").eq("id", id).maybeSingle(),
        supabase.from("recitation_records").select("*").eq("student_id", id).order("record_date", { ascending: false }).limit(30),
        supabase.from("attendance").select("status").eq("student_id", id),
      ]);

      setStudent(studentRes.data);
      setRecords(recordsRes.data || []);

      const att = attendanceRes.data || [];
      setAttendanceStats({
        present: att.filter((a: any) => a.status === "present").length,
        absent: att.filter((a: any) => a.status === "absent").length,
        total: att.length,
      });
    };
    fetchData();
  }, [id]);

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

      {/* Recitation History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            سجل التسميعات
          </CardTitle>
        </CardHeader>
        <CardContent>
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
                  <div className="flex items-center gap-3">
                    {r.audio_url && (
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
                    )}
                    <div className={`text-sm font-bold min-w-[2rem] text-left ${
                      Number(r.total_score) >= 80 ? "text-success" : Number(r.total_score) >= 60 ? "text-warning" : "text-destructive"
                    }`}>
                      {r.total_score}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StudentProfile;
