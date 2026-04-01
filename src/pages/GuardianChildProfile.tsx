import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import GuardianLayout from "@/components/GuardianLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowRight, User, Calendar, TrendingUp, Play, BookOpen,
  CheckCircle2, XCircle, Clock, AlertTriangle, Award, MapPin,
} from "lucide-react";

const GuardianChildProfile = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [guardian, setGuardian] = useState<any>(null);
  const [student, setStudent] = useState<any>(null);
  const [records, setRecords] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [badges, setBadges] = useState<any[]>([]);
  const [trips, setTrips] = useState<any[]>([]);
  const [annualPlan, setAnnualPlan] = useState<any>(null);
  const [planProgress, setPlanProgress] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    const fetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/guardian-auth"); return; }

      const { data: gProfile } = await supabase
        .from("guardian_profiles")
        .select("*")
        .eq("id", session.user.id)
        .maybeSingle();
      if (!gProfile) { navigate("/guardian-auth"); return; }
      setGuardian(gProfile);

      // Verify guardian has access to this student
      const { data: link } = await supabase
        .from("guardian_students")
        .select("id")
        .eq("guardian_id", session.user.id)
        .eq("student_id", id)
        .maybeSingle();
      if (!link) { navigate("/guardian"); return; }

      const [studentRes, recordsRes, attendanceRes, badgesRes] = await Promise.all([
        supabase.from("students").select("*, halaqat(name)").eq("id", id).maybeSingle(),
        supabase.from("recitation_records").select("*").eq("student_id", id).order("record_date", { ascending: false }).limit(30),
        supabase.from("attendance").select("*").eq("student_id", id).order("attendance_date", { ascending: false }).limit(30),
        supabase.from("student_badges").select("*, badges(name, icon, description)").eq("student_id", id).order("awarded_at", { ascending: false }),
      ]);

      setStudent(studentRes.data);
      setRecords(recordsRes.data || []);
      setAttendance(attendanceRes.data || []);
      setBadges(badgesRes.data || []);

      // Get trips for this student's halaqa
      if (studentRes.data?.halaqa_id) {
        const { data: tripsData } = await supabase
          .from("trips")
          .select("*")
          .eq("halaqa_id", studentRes.data.halaqa_id)
          .order("trip_date", { ascending: false })
          .limit(10);
        setTrips(tripsData || []);
      }

      // Get annual plan
      const { data: plans } = await supabase
        .from("student_annual_plans")
        .select("*")
        .eq("student_id", id)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1);
      if (plans?.[0]) {
        setAnnualPlan(plans[0]);
        const { data: prog } = await supabase
          .from("student_plan_progress")
          .select("actual_pages, target_pages")
          .eq("plan_id", plans[0].id);
        setPlanProgress(prog || []);
      }

      setLoading(false);
    };
    fetchData();
  }, [id, navigate]);

  if (loading || !student) {
    return (
      <GuardianLayout>
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </GuardianLayout>
    );
  }

  const avgScore = records.length
    ? Math.round(records.reduce((s, r) => s + Number(r.total_score || 0), 0) / records.length)
    : 0;
  const avgMistakes = records.length
    ? Math.round(records.reduce((s, r) => s + (r.mistakes_count || 0), 0) / records.length)
    : 0;
  const attendancePresent = attendance.filter(a => a.status === "present" || a.status === "late").length;
  const attendancePercent = attendance.length ? Math.round((attendancePresent / attendance.length) * 100) : 0;
  const progressPercent = Math.min(100, Math.round(((student.total_memorized_pages || 0) / 604) * 100));

  const statusIcon = (status: string) => {
    switch (status) {
      case "present": return <CheckCircle2 className="w-4 h-4 text-success" />;
      case "absent": return <XCircle className="w-4 h-4 text-destructive" />;
      case "late": return <Clock className="w-4 h-4 text-warning" />;
      case "excused": return <AlertTriangle className="w-4 h-4 text-info" />;
      default: return null;
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "present": return "حاضر";
      case "absent": return "غائب";
      case "late": return "متأخر";
      case "excused": return "معذور";
      default: return status;
    }
  };

  const tripStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      not_started: "لم تبدأ",
      departed: "انطلقت",
      arrived: "وصلت",
      activity_ongoing: "نشاط جارٍ",
      returning: "في طريق العودة",
      finished: "انتهت",
    };
    return map[status] || status;
  };

  const tripStatusColor = (status: string) => {
    switch (status) {
      case "not_started": return "bg-muted text-muted-foreground";
      case "departed": return "bg-info/15 text-info";
      case "arrived": return "bg-success/15 text-success";
      case "activity_ongoing": return "bg-warning/15 text-warning";
      case "returning": return "bg-info/15 text-info";
      case "finished": return "bg-muted text-muted-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <GuardianLayout guardianName={guardian?.full_name}>
      <div className="space-y-4 animate-fade-in">
        <Button variant="ghost" size="sm" onClick={() => navigate("/guardian")}>
          <ArrowRight className="w-4 h-4 ml-1" />
          رجوع
        </Button>

        {/* Student Header */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
                <User className="w-7 h-7 text-primary" />
              </div>
              <div className="flex-1">
                <h1 className="text-lg font-bold">{student.full_name}</h1>
                <p className="text-xs text-muted-foreground">{student.halaqat?.name || "بدون حلقة"}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="secondary" className="text-xs">{student.current_level}</Badge>
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
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-2">
              <BookOpen className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">تقدم الحفظ</span>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>{student.total_memorized_pages || 0} صفحة</span>
                <span className="text-muted-foreground">من 604</span>
              </div>
              <Progress value={progressPercent} className="h-3" />
              <p className="text-xs text-muted-foreground text-center">{progressPercent}%</p>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-xl font-bold text-primary">{avgScore}</p>
              <p className="text-[10px] text-muted-foreground">متوسط الدرجة</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-xl font-bold text-destructive">{avgMistakes}</p>
              <p className="text-[10px] text-muted-foreground">متوسط الأخطاء</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-xl font-bold text-success">{attendancePercent}%</p>
              <p className="text-[10px] text-muted-foreground">نسبة الحضور</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="recitations" className="w-full">
          <TabsList className="w-full grid grid-cols-5">
            <TabsTrigger value="recitations" className="text-xs">التسميع</TabsTrigger>
            <TabsTrigger value="attendance" className="text-xs">الحضور</TabsTrigger>
            <TabsTrigger value="badges" className="text-xs">الشارات</TabsTrigger>
            <TabsTrigger value="trips" className="text-xs">الرحلات</TabsTrigger>
            <TabsTrigger value="madarij" className="text-xs">مدارج</TabsTrigger>
          </TabsList>

          {/* Recitations Tab */}
          <TabsContent value="recitations">
            <Card>
              <CardContent className="p-4">
                {records.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">لا توجد سجلات</p>
                ) : (
                  <div className="space-y-3">
                    {records.map((r) => (
                      <div key={r.id} className="py-3 border-b last:border-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground">{r.record_date}</span>
                          <span className={`text-sm font-bold ${
                            Number(r.total_score) >= 80 ? "text-success" : Number(r.total_score) >= 60 ? "text-warning" : "text-destructive"
                          }`}>
                            {r.total_score}
                          </span>
                        </div>
                        {r.memorized_from && r.memorized_to && (
                          <p className="text-sm">حفظ: {r.memorized_from} → {r.memorized_to}</p>
                        )}
                        {r.review_from && r.review_to && (
                          <p className="text-xs text-muted-foreground">مراجعة: {r.review_from} → {r.review_to}</p>
                        )}
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span>جودة: {r.memorization_quality || 0}</span>
                          <span>تجويد: {r.tajweed_score || 0}</span>
                          <span>أخطاء: {r.mistakes_count || 0}</span>
                        </div>
                        {r.notes && (
                          <p className="text-xs mt-1 text-muted-foreground bg-muted/50 rounded p-2">📝 {r.notes}</p>
                        )}
                        {r.audio_url && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="mt-2 h-7 text-xs"
                            onClick={() => {
                              const audio = new Audio(r.audio_url);
                              audio.play();
                            }}
                          >
                            <Play className="w-3 h-3 ml-1" />
                            استمع للتلاوة
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Attendance Tab */}
          <TabsContent value="attendance">
            <Card>
              <CardContent className="p-4">
                {attendance.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">لا توجد سجلات حضور</p>
                ) : (
                  <div className="space-y-2">
                    {attendance.map((a) => (
                      <div key={a.id} className="flex items-center justify-between py-2 border-b last:border-0">
                        <div className="flex items-center gap-2">
                          {statusIcon(a.status)}
                          <span className="text-sm">{statusLabel(a.status)}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{a.attendance_date}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Badges Tab */}
          <TabsContent value="badges">
            <Card>
              <CardContent className="p-4">
                {badges.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">لم يحصل على شارات بعد</p>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {badges.map((sb) => (
                      <div key={sb.id} className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                        <Award className="w-5 h-5 text-accent" />
                        <div>
                          <p className="text-sm font-medium">{sb.badges?.name}</p>
                          <p className="text-[10px] text-muted-foreground">{sb.badges?.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Trips Tab */}
          <TabsContent value="trips">
            <Card>
              <CardContent className="p-4">
                {trips.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">لا توجد رحلات</p>
                ) : (
                  <div className="space-y-3">
                    {trips.map((trip) => (
                      <div key={trip.id} className="p-3 rounded-lg border">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-primary" />
                            <span className="text-sm font-medium">{trip.title}</span>
                          </div>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${tripStatusColor(trip.status)}`}>
                            {tripStatusLabel(trip.status)}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">{trip.trip_date}</p>
                        {trip.description && (
                          <p className="text-xs text-muted-foreground mt-1">{trip.description}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </GuardianLayout>
  );
};

export default GuardianChildProfile;
