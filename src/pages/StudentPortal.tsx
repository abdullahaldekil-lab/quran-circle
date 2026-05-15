import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  BookOpen, Loader2, Calendar, MapPin, Award, ScrollText,
  CheckSquare, GraduationCap, ClipboardList, Home, X, ExternalLink,
} from "lucide-react";

const statusLabel: Record<string, { label: string; cls: string }> = {
  present: { label: "حاضر", cls: "bg-green-100 text-green-800 border-green-300" },
  absent: { label: "غائب", cls: "bg-red-100 text-red-800 border-red-300" },
  late: { label: "متأخر", cls: "bg-yellow-100 text-yellow-800 border-yellow-300" },
  excused: { label: "معذور", cls: "bg-blue-100 text-blue-800 border-blue-300" },
};

export default function StudentPortal() {
  const { code } = useParams<{ code?: string }>();
  const navigate = useNavigate();
  const [inputCode, setInputCode] = useState(code || "");
  const [student, setStudent] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [halaqa, setHalaqa] = useState<any>(null);
  const [plan, setPlan] = useState<any>(null);
  const [progress, setProgress] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [narration, setNarration] = useState<any[]>([]);

  const [externalUrl, setExternalUrl] = useState("");
  const [externalName, setExternalName] = useState("");
  const [showExternal, setShowExternal] = useState(false);
  const [iframeError, setIframeError] = useState(false);

  const handleSearch = async (rawCode?: string) => {
    const codeToUse = (rawCode ?? inputCode).trim().toUpperCase();
    if (!codeToUse) return;
    setLoading(true); setError("");
    try {
      const { data: s } = await supabase
        .from("students")
        .select("*, halaqat(name, schedule, location)")
        .eq("student_code", codeToUse)
        .eq("status", "active")
        .maybeSingle();

      if (!s) {
        setError("الكود غير صحيح أو الطالب غير نشط");
        setStudent(null);
        setLoading(false);
        return;
      }
      setStudent(s);
      setHalaqa((s as any).halaqat);

      const { data: planData } = await supabase
        .from("student_annual_plans")
        .select("*, student_plan_progress(*)")
        .eq("student_id", s.id)
        .eq("status", "active")
        .maybeSingle();
      setPlan(planData);
      setProgress((planData as any)?.student_plan_progress || []);

      const monthAgo = new Date();
      monthAgo.setDate(monthAgo.getDate() - 30);
      const { data: att } = await supabase
        .from("attendance")
        .select("attendance_date, status")
        .eq("student_id", s.id)
        .gte("attendance_date", monthAgo.toISOString().split("T")[0])
        .order("attendance_date", { ascending: false });
      setAttendance(att || []);

      const { data: narr } = await supabase
        .from("narration_test_results")
        .select("test_date, total_score, status, certificate_number")
        .eq("student_id", s.id)
        .order("test_date", { ascending: false })
        .limit(5);
      setNarration(narr || []);

      if (s.halaqa_id) {
        const { data: progs } = await supabase
          .from("talqeen_program_assignments")
          .select("*, talqeen_curricula(name, description)")
          .eq("halaqa_id", s.halaqa_id)
          .eq("is_active", true);
        setPrograms(progs || []);
      } else {
        setPrograms([]);
      }
    } catch (e: any) {
      setError("حدث خطأ أثناء جلب البيانات");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (code) handleSearch(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openExternalLink = (url: string, name: string) => {
    setExternalUrl(url);
    setExternalName(name);
    setIframeError(false);
    setShowExternal(true);
  };

  const presentCount = attendance.filter(a => a.status === "present").length;
  const lateCount = attendance.filter(a => a.status === "late").length;
  const totalDays = attendance.length;
  const attendanceRate = totalDays ? Math.round(((presentCount + lateCount) / totalDays) * 100) : 0;

  const totalMemorized = progress.reduce((sum, p) => sum + (Number(p.actual_memorization) || 0), 0);
  const totalReviewed = progress.reduce((sum, p) => sum + (Number(p.actual_review) || 0), 0);
  const totalLinked = progress.reduce((sum, p) => sum + (Number(p.actual_linking) || 0), 0);
  const planTarget = plan ? Number(plan.target_memorization || 0) : 0;
  const planProgress = planTarget ? Math.min(100, Math.round((totalMemorized / planTarget) * 100)) : 0;

  const lastNarration = narration[0];

  // Current Hijri month progress (latest entry by hijri_month)
  const currentMonthProgress = [...progress].sort((a, b) =>
    (b.hijri_month || 0) - (a.hijri_month || 0)
  )[0];
  const monthTarget = Number(currentMonthProgress?.target_memorization || 0);
  const monthMemorized = Number(currentMonthProgress?.actual_memorization || 0);
  const monthReviewed = Number(currentMonthProgress?.actual_review || 0);
  const monthLinked = Number(currentMonthProgress?.actual_linking || 0);
  const monthPercent = monthTarget ? Math.min(100, Math.round((monthMemorized / monthTarget) * 100)) : 0;

  if (!student) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex flex-col items-center justify-center p-6" dir="rtl">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-10 h-10 text-green-700" />
            </div>
            <h1 className="text-2xl font-bold text-green-900">مجمع حويلان</h1>
            <p className="text-muted-foreground text-sm mt-1">بوابة الطالب</p>
          </div>
          <Card className="p-6 space-y-4">
            <div className="space-y-2">
              <Label>كود الطالب</Label>
              <Input
                placeholder="مثال: HW12345"
                value={inputCode}
                onChange={e => setInputCode(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === "Enter" && handleSearch()}
                className="text-center text-lg font-mono tracking-widest h-12"
                maxLength={7}
                autoFocus
              />
            </div>
            {error && <p className="text-sm text-destructive text-center">{error}</p>}
            <Button
              className="w-full h-11 bg-green-700 hover:bg-green-800 text-white"
              onClick={() => handleSearch()}
              disabled={loading}
            >
              {loading ? <Loader2 className="animate-spin w-5 h-5" /> : "دخول"}
            </Button>
          </Card>
          <p className="text-center text-xs text-muted-foreground">
            الكود موجود في ملف الطالب — تواصل مع إدارة المجمع للحصول عليه
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <div className="bg-green-700 text-white p-4 text-center">
        <p className="text-lg font-bold">{student.full_name}</p>
        <p className="text-sm opacity-80">{halaqa?.name || "بدون حلقة"} — {student.student_code}</p>
        <Button
          variant="ghost"
          size="sm"
          className="text-white/80 hover:text-white hover:bg-white/10 mt-1 text-xs"
          onClick={() => { setStudent(null); setInputCode(""); navigate("/student-portal"); }}
        >
          تسجيل خروج
        </Button>
      </div>

      <div className="max-w-3xl mx-auto p-3 sm:p-4">
        <Tabs defaultValue="home" className="w-full">
          <TabsList className="grid grid-cols-5 w-full h-auto">
            <TabsTrigger value="home" className="text-xs flex-col gap-1 py-2"><Home className="w-4 h-4" />الرئيسية</TabsTrigger>
            <TabsTrigger value="attendance" className="text-xs flex-col gap-1 py-2"><CheckSquare className="w-4 h-4" />الحضور</TabsTrigger>
            <TabsTrigger value="plan" className="text-xs flex-col gap-1 py-2"><GraduationCap className="w-4 h-4" />الخطة</TabsTrigger>
            <TabsTrigger value="narration" className="text-xs flex-col gap-1 py-2"><ScrollText className="w-4 h-4" />السرد</TabsTrigger>
            <TabsTrigger value="programs" className="text-xs flex-col gap-1 py-2"><Award className="w-4 h-4" />البرامج</TabsTrigger>
          </TabsList>

          {/* الرئيسية */}
          <TabsContent value="home" className="space-y-3 mt-4">
            <div className="grid grid-cols-3 gap-2">
              <Card className="p-3 text-center">
                <p className="text-xs text-muted-foreground">حضور الشهر</p>
                <p className="text-2xl font-bold text-green-700">{attendanceRate}%</p>
              </Card>
              <Card className="p-3 text-center">
                <p className="text-xs text-muted-foreground">وجوه الحفظ</p>
                <p className="text-2xl font-bold text-blue-700">{totalMemorized}</p>
              </Card>
              <Card className="p-3 text-center">
                <p className="text-xs text-muted-foreground">آخر سرد</p>
                <p className="text-2xl font-bold text-amber-700">
                  {lastNarration ? `${lastNarration.total_score}` : "—"}
                </p>
              </Card>
            </div>

            {/* لوحة ملخصة: تقدم الحفظ السنوي */}
            {plan && (
              <Card className="p-4 space-y-3 border-green-200 bg-gradient-to-br from-green-50 to-white">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-green-700" />
                    <p className="text-sm font-bold text-green-900">تقدم الحفظ السنوي</p>
                  </div>
                  <Badge className="bg-green-700">{planProgress}%</Badge>
                </div>
                <Progress value={planProgress} className="h-2.5" />
                <p className="text-xs text-muted-foreground text-center">
                  {totalMemorized} من {planTarget} وجه
                </p>
              </Card>
            )}

            {/* ملخص الشهر الحالي */}
            {currentMonthProgress && (
              <Card className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-blue-700" />
                    الشهر الحالي: {currentMonthProgress.hijri_month_name || `شهر ${currentMonthProgress.hijri_month}`}
                  </p>
                  {monthTarget > 0 && (
                    <Badge variant="outline" className="bg-blue-50 text-blue-800 border-blue-300">
                      {monthPercent}%
                    </Badge>
                  )}
                </div>
                {monthTarget > 0 && <Progress value={monthPercent} className="h-2" />}
                <div className="grid grid-cols-3 gap-2 text-center pt-1">
                  <div className="bg-green-50 rounded-lg p-2">
                    <p className="text-[10px] text-green-700">حفظ</p>
                    <p className="text-lg font-bold text-green-800">{monthMemorized}</p>
                    {monthTarget > 0 && (
                      <p className="text-[10px] text-muted-foreground">/ {monthTarget}</p>
                    )}
                  </div>
                  <div className="bg-blue-50 rounded-lg p-2">
                    <p className="text-[10px] text-blue-700">مراجعة</p>
                    <p className="text-lg font-bold text-blue-800">{monthReviewed}</p>
                  </div>
                  <div className="bg-purple-50 rounded-lg p-2">
                    <p className="text-[10px] text-purple-700">ربط</p>
                    <p className="text-lg font-bold text-purple-800">{monthLinked}</p>
                  </div>
                </div>
              </Card>
            )}

            {/* ملخص الحضور */}
            <Card className="p-4 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-bold flex items-center gap-2">
                  <CheckSquare className="w-4 h-4 text-green-700" />
                  حضور آخر 30 يوم
                </p>
                <Badge className="bg-green-700">{attendanceRate}%</Badge>
              </div>
              <Progress value={attendanceRate} className="h-2" />
              <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1">
                <div>
                  <p className="text-green-700 font-bold text-lg">{presentCount}</p>
                  <p className="text-muted-foreground">حاضر</p>
                </div>
                <div>
                  <p className="text-yellow-700 font-bold text-lg">{lateCount}</p>
                  <p className="text-muted-foreground">متأخر</p>
                </div>
                <div>
                  <p className="text-red-700 font-bold text-lg">{totalDays - presentCount - lateCount}</p>
                  <p className="text-muted-foreground">غياب/معذور</p>
                </div>
              </div>
            </Card>

            {halaqa && (
              <Card className="p-4 space-y-2">
                <p className="font-bold flex items-center gap-2"><BookOpen className="w-4 h-4 text-green-700" />{halaqa.name}</p>
                {halaqa.location && (
                  <p className="text-sm text-muted-foreground flex items-center gap-2"><MapPin className="w-4 h-4" />{halaqa.location}</p>
                )}
                {halaqa.schedule && (
                  <p className="text-sm text-muted-foreground flex items-center gap-2"><Calendar className="w-4 h-4" />{halaqa.schedule}</p>
                )}
              </Card>
            )}
          </TabsContent>

          {/* الحضور */}
          <TabsContent value="attendance" className="space-y-3 mt-4">
            <Card className="p-4 text-center">
              <p className="text-sm text-muted-foreground">نسبة الحضور (آخر 30 يوم)</p>
              <p className="text-3xl font-bold text-green-700 mt-1">{attendanceRate}%</p>
              <p className="text-xs text-muted-foreground mt-1">
                {presentCount} حاضر • {lateCount} متأخر • {totalDays - presentCount - lateCount} غياب/معذور
              </p>
            </Card>
            <Card>
              <CardContent className="p-0 max-h-[60vh] overflow-y-auto">
                {attendance.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground p-6">لا توجد بيانات حضور</p>
                )}
                {attendance.map((a, i) => {
                  const sl = statusLabel[a.status] || { label: a.status, cls: "bg-gray-100 text-gray-800" };
                  return (
                    <div key={i} className="flex items-center justify-between border-b last:border-b-0 px-4 py-2">
                      <span className="text-sm">{a.attendance_date}</span>
                      <Badge variant="outline" className={sl.cls}>{sl.label}</Badge>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </TabsContent>

          {/* الخطة السنوية */}
          <TabsContent value="plan" className="space-y-3 mt-4">
            {!plan && (
              <Card className="p-6 text-center text-sm text-muted-foreground">لا توجد خطة سنوية نشطة</Card>
            )}
            {plan && (
              <>
                <Card className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold">{plan.plan_type === "gold" ? "الخطة الذهبية" : plan.plan_type === "silver" ? "الخطة الفضية" : "الخطة السنوية"}</p>
                      <p className="text-xs text-muted-foreground">المستهدف: {planTarget} وجه</p>
                    </div>
                    <Badge className="bg-green-700">{planProgress}%</Badge>
                  </div>
                  <Progress value={planProgress} className="h-3" />
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div><p className="text-muted-foreground">حفظ</p><p className="font-bold text-green-700">{totalMemorized}</p></div>
                    <div><p className="text-muted-foreground">مراجعة</p><p className="font-bold text-blue-700">{totalReviewed}</p></div>
                    <div><p className="text-muted-foreground">ربط</p><p className="font-bold text-purple-700">{totalLinked}</p></div>
                  </div>
                </Card>

                <Card>
                  <CardContent className="p-0 max-h-[50vh] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-right">الشهر</th>
                          <th className="px-2 py-2 text-center">المستهدف</th>
                          <th className="px-2 py-2 text-center">حفظ</th>
                          <th className="px-2 py-2 text-center">مراجعة</th>
                          <th className="px-2 py-2 text-center">ربط</th>
                        </tr>
                      </thead>
                      <tbody>
                        {progress.length === 0 && (
                          <tr><td colSpan={5} className="text-center text-muted-foreground p-4">لا توجد بيانات شهرية</td></tr>
                        )}
                        {progress.map((p, i) => (
                          <tr key={i} className="border-b last:border-b-0">
                            <td className="px-3 py-2">{p.hijri_month_name || p.hijri_month || "—"}</td>
                            <td className="px-2 py-2 text-center">{p.target_memorization || 0}</td>
                            <td className="px-2 py-2 text-center text-green-700">{p.actual_memorization || 0}</td>
                            <td className="px-2 py-2 text-center text-blue-700">{p.actual_review || 0}</td>
                            <td className="px-2 py-2 text-center text-purple-700">{p.actual_linking || 0}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* السرد */}
          <TabsContent value="narration" className="space-y-3 mt-4">
            {narration.length === 0 && (
              <Card className="p-6 text-center text-sm text-muted-foreground">لا توجد جلسات سرد</Card>
            )}
            {narration.map((n, i) => (
              <Card key={i} className="p-4 flex items-center justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-sm font-bold">{n.test_date}</p>
                  <div className="flex items-center gap-2">
                    <Badge className={n.status === "passed" ? "bg-green-700" : "bg-red-600"}>
                      {n.status === "passed" ? "ناجح" : "راسب"}
                    </Badge>
                    <span className="text-sm">الدرجة: <strong>{n.total_score}</strong></span>
                  </div>
                </div>
                {n.certificate_number && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(`/verify-certificate/${n.certificate_number}`)}
                  >
                    <Award className="w-4 h-4 ml-1" />
                    الشهادة
                  </Button>
                )}
              </Card>
            ))}
          </TabsContent>

          {/* البرامج */}
          <TabsContent value="programs" className="space-y-3 mt-4">
            {programs.length === 0 && (
              <Card className="p-6 text-center text-sm text-muted-foreground">لا توجد برامج مُسنَدة لحلقتك</Card>
            )}
            {programs.map((pr, i) => (
              <Card key={i} className="p-4 space-y-2">
                <p className="font-bold flex items-center gap-2">
                  <ClipboardList className="w-4 h-4 text-green-700" />
                  {pr.talqeen_curricula?.name || "برنامج"}
                </p>
                {pr.talqeen_curricula?.description && (
                  <p className="text-xs text-muted-foreground">{pr.talqeen_curricula.description}</p>
                )}
                {pr.start_date && (
                  <p className="text-xs text-muted-foreground">بداية: {pr.start_date}</p>
                )}
              </Card>
            ))}

            {/* روابط تعليمية */}
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-muted-foreground mb-3">روابط تعليمية</h3>
              <div className="grid grid-cols-1 gap-3">
                {[
                  {
                    name: "متجر سنابل",
                    desc: "كتب ومصادر تعليمية إسلامية",
                    icon: "📚",
                    color: "bg-amber-50 border-amber-200 text-amber-800",
                    url: "https://sanabelstore.com",
                  },
                  {
                    name: "موقع القيم القرآنية",
                    desc: "منهج القيم القرآنية للناشئة",
                    icon: "📖",
                    color: "bg-green-50 border-green-200 text-green-800",
                    url: "https://quranvalues.com",
                  },
                  {
                    name: "منصة حل",
                    desc: "شرح المناهج الدراسية",
                    icon: "🎓",
                    color: "bg-blue-50 border-blue-200 text-blue-800",
                    url: "https://hall.com",
                  },
                ].map(link => (
                  <button
                    key={link.name}
                    onClick={() => openExternalLink(link.url, link.name)}
                    className={`flex items-center gap-3 p-4 rounded-xl border text-right w-full transition-all active:scale-95 ${link.color}`}
                  >
                    <span className="text-2xl">{link.icon}</span>
                    <div className="flex-1">
                      <p className="font-semibold text-sm">{link.name}</p>
                      <p className="text-xs opacity-70 mt-0.5">{link.desc}</p>
                    </div>
                    <ExternalLink className="w-4 h-4 opacity-50" />
                  </button>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* نافذة عرض روابط خارجية */}
        {showExternal && (
          <div className="fixed inset-0 z-50 flex flex-col bg-background" dir="rtl">
            <div className="flex items-center justify-between p-3 border-b bg-card">
              <button
                onClick={() => setShowExternal(false)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" /> إغلاق
              </button>
              <span className="text-sm font-medium">{externalName}</span>
              <a
                href={externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
              >
                فتح خارجياً <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <iframe
              src={externalUrl}
              className="flex-1 w-full border-0"
              title={externalName}
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
              loading="lazy"
              onError={() => setIframeError(true)}
            />
            {iframeError && (
              <div className="p-6 border-t bg-muted/30 text-center space-y-3">
                <p className="text-sm text-muted-foreground">لا يمكن عرض الموقع داخل التطبيق بسبب سياسات الأمان</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(externalUrl, "_blank")}
                >
                  <ExternalLink className="w-4 h-4 ml-1" />
                  فتح في تبويب جديد
                </Button>
              </div>
            )}
            <div className="p-4 border-t bg-muted/30 text-center">
              <p className="text-xs text-muted-foreground">
                إذا لم يظهر المحتوى
                <a href={externalUrl} target="_blank" rel="noopener noreferrer"
                  className="text-primary mx-1 underline">
                  اضغط هنا للفتح مباشرة
                </a>
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
