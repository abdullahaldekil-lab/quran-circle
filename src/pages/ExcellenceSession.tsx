import { useState, useEffect, useRef, useCallback } from "react";
import StudentNameLink from "@/components/StudentNameLink";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowRight, Save, Printer, Users, BarChart3, ClipboardList } from "lucide-react";

import { formatHijriStringArabic, formatGregorianArabic } from "@/lib/hijri";
import ExcellencePrintTemplate from "@/components/ExcellencePrintTemplate";

interface Student {
  id: string;
  full_name: string;
}

interface AttendanceRecord {
  id?: string;
  student_id: string;
  is_present: boolean;
  notes: string;
}

interface PerformanceRecord {
  id?: string;
  student_id: string;
  pages_displayed: number;
  hizb_count: number;
  mistakes_count: number;
  warnings_count: number;
  lahon_count: number;
  total_score: number;
  rank_in_group: number | null;
}

interface ExcellenceSettings {
  max_grade: number;
  deduction_per_mistake: number;
  deduction_per_lahn: number;
  deduction_per_warning: number;
}

const DEFAULT_SETTINGS: ExcellenceSettings = {
  max_grade: 100,
  deduction_per_mistake: 2,
  deduction_per_lahn: 1,
  deduction_per_warning: 0.5,
};

function calcScore(p: PerformanceRecord, settings: ExcellenceSettings): number {
  return Math.max(0, settings.max_grade - p.mistakes_count * settings.deduction_per_mistake - p.lahon_count * settings.deduction_per_lahn - p.warnings_count * settings.deduction_per_warning);
}

function calcRanks(perfs: PerformanceRecord[]): PerformanceRecord[] {
  const sorted = [...perfs].sort((a, b) => {
    if (b.total_score !== a.total_score) return b.total_score - a.total_score;
    if (b.hizb_count !== a.hizb_count) return b.hizb_count - a.hizb_count;
    return b.pages_displayed - a.pages_displayed;
  });
  return sorted.map((p, i) => ({ ...p, rank_in_group: i + 1 }));
}

export default function ExcellenceSession() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { isSupervisor } = useRole();
  const printRef = useRef<HTMLDivElement>(null);

  const [session, setSession] = useState<any>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Record<string, AttendanceRecord>>({});
  const [performance, setPerformance] = useState<Record<string, PerformanceRecord>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<ExcellenceSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    if (sessionId) fetchAll();
  }, [sessionId]);

  const fetchAll = async () => {
    setLoading(true);

    // Fetch settings
    const { data: settingsData } = await supabase
      .from("excellence_settings")
      .select("*")
      .limit(1)
      .single();
    if (settingsData) {
      setSettings({
        max_grade: Number(settingsData.max_grade),
        deduction_per_mistake: Number(settingsData.deduction_per_mistake),
        deduction_per_lahn: Number(settingsData.deduction_per_lahn),
        deduction_per_warning: Number(settingsData.deduction_per_warning),
      });
    }

    // Fetch session with track info
    const { data: sess } = await supabase
      .from("excellence_sessions")
      .select("*, halaqat(name), excellence_tracks:track_id(track_name)")
      .eq("id", sessionId!)
      .single();

    if (!sess) {
      toast.error("الجلسة غير موجودة");
      navigate("/excellence");
      return;
    }
    setSession(sess);

    // Fetch students: prefer distinguished_students by track_id, fallback to elite/halaqa
    let studentList: Student[] = [];
    const trackId = (sess as any).track_id;

    if (trackId) {
      // Fetch distinguished students for this track (central list)
      const { data: distData } = await supabase
        .from("distinguished_students")
        .select("student_id")
        .eq("track_id", trackId);

      const distIds = (distData || []).map((d: any) => d.student_id);
      if (distIds.length > 0) {
        const { data: studs } = await (supabase
          .from("students")
          .select("id, full_name") as any)
          .in("id", distIds)
          .eq("status", "active")
          .order("full_name") as { data: Student[] | null };
        studentList = studs || [];
      }
    }

    // Fallback: try elite students by halaqa if no track-based students found
    if (studentList.length === 0 && sess.halaqa_id) {
      const { data: eliteData } = await supabase
        .from("excellence_elite_students")
        .select("student_id")
        .eq("halaqa_id", sess.halaqa_id);
      const eliteIds = (eliteData || []).map((e: any) => e.student_id);
      if (eliteIds.length > 0) {
        const { data: studs } = await (supabase
          .from("students")
          .select("id, full_name") as any)
          .in("id", eliteIds)
          .eq("status", "active")
          .order("full_name") as { data: Student[] | null };
        studentList = studs || [];
      } else {
        const { data: studs } = await (supabase
          .from("students")
          .select("id, full_name") as any)
          .eq("halaqa_id", sess.halaqa_id)
          .eq("status", "active")
          .order("full_name") as { data: Student[] | null };
        studentList = studs || [];
      }
    }

    setStudents(studentList);

    // Fetch existing attendance
    const { data: attData } = await supabase
      .from("excellence_attendance")
      .select("*")
      .eq("session_id", sessionId!);

    const attMap: Record<string, AttendanceRecord> = {};
    studentList.forEach((s) => {
      const existing = attData?.find((a) => a.student_id === s.id);
      attMap[s.id] = existing
        ? { id: existing.id, student_id: s.id, is_present: existing.is_present, notes: existing.notes || "" }
        : { student_id: s.id, is_present: true, notes: "" };
    });
    setAttendance(attMap);

    // Fetch existing performance
    const { data: perfData } = await supabase
      .from("excellence_performance")
      .select("*")
      .eq("session_id", sessionId!);

    const perfMap: Record<string, PerformanceRecord> = {};
    studentList.forEach((s) => {
      const existing = perfData?.find((p) => p.student_id === s.id);
      perfMap[s.id] = existing
        ? {
            id: existing.id,
            student_id: s.id,
            pages_displayed: Number(existing.pages_displayed),
            hizb_count: Number(existing.hizb_count),
            mistakes_count: existing.mistakes_count,
            warnings_count: existing.warnings_count,
            lahon_count: existing.lahon_count,
            total_score: Number(existing.total_score),
            rank_in_group: existing.rank_in_group,
          }
        : {
            student_id: s.id,
            pages_displayed: 0,
            hizb_count: 0,
            mistakes_count: 0,
            warnings_count: 0,
            lahon_count: 0,
            total_score: 0,
            rank_in_group: null,
          };
    });
    setPerformance(perfMap);
    setLoading(false);
  };

  const updateAttendance = (studentId: string, field: keyof AttendanceRecord, value: any) => {
    setAttendance((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], [field]: value },
    }));
  };

  const updatePerformance = (studentId: string, field: keyof PerformanceRecord, value: number) => {
    setPerformance((prev) => {
      const updated = { ...prev[studentId], [field]: value };
      updated.total_score = calcScore(updated, settings);
      return { ...prev, [studentId]: updated };
    });
  };

  const presentStudentIds = Object.values(attendance)
    .filter((a) => a.is_present)
    .map((a) => a.student_id);

  const saveAttendance = async () => {
    setSaving(true);
    const records = Object.values(attendance);

    for (const rec of records) {
      if (rec.id) {
        await supabase
          .from("excellence_attendance")
          .update({ is_present: rec.is_present, notes: rec.notes || null })
          .eq("id", rec.id);
      } else {
        const { data } = await supabase
          .from("excellence_attendance")
          .insert({
            session_id: sessionId!,
            student_id: rec.student_id,
            is_present: rec.is_present,
            notes: rec.notes || null,
          })
          .select()
          .single();
        if (data) {
          setAttendance((prev) => ({
            ...prev,
            [rec.student_id]: { ...prev[rec.student_id], id: data.id },
          }));
        }
      }
    }
    toast.success("تم حفظ التحضير");
    setSaving(false);
  };

  const savePerformance = async () => {
    setSaving(true);
    const presentPerfs = presentStudentIds.map((id) => performance[id]).filter(Boolean);
    const ranked = calcRanks(presentPerfs);

    const newPerfMap = { ...performance };
    ranked.forEach((r) => {
      newPerfMap[r.student_id] = r;
    });
    setPerformance(newPerfMap);

    let totalHizb = 0;
    let totalPages = 0;

    for (const rec of ranked) {
      totalHizb += rec.hizb_count;
      totalPages += rec.pages_displayed;

      if (rec.id) {
        await supabase
          .from("excellence_performance")
          .update({
            pages_displayed: rec.pages_displayed,
            hizb_count: rec.hizb_count,
            mistakes_count: rec.mistakes_count,
            warnings_count: rec.warnings_count,
            lahon_count: rec.lahon_count,
            total_score: rec.total_score,
            rank_in_group: rec.rank_in_group,
          })
          .eq("id", rec.id);
      } else {
        const { data } = await supabase
          .from("excellence_performance")
          .insert({
            session_id: sessionId!,
            student_id: rec.student_id,
            pages_displayed: rec.pages_displayed,
            hizb_count: rec.hizb_count,
            mistakes_count: rec.mistakes_count,
            warnings_count: rec.warnings_count,
            lahon_count: rec.lahon_count,
            total_score: rec.total_score,
            rank_in_group: rec.rank_in_group,
          })
          .select()
          .single();
        if (data) {
          newPerfMap[rec.student_id] = { ...newPerfMap[rec.student_id], id: data.id };
        }
      }
    }

    await supabase
      .from("excellence_sessions")
      .update({ total_hizb_in_session: totalHizb, total_pages_displayed: totalPages })
      .eq("id", sessionId!);

    setPerformance(newPerfMap);
    toast.success("تم حفظ الأداء والترتيب");
    setSaving(false);
  };

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html dir="rtl"><head><title>تقرير التميّز</title>
      <style>body{font-family:Arial,sans-serif;padding:20px;direction:rtl}@media print{body{padding:0}}</style>
      </head><body>${printContent.innerHTML}</body></html>
    `);
    win.document.close();
    win.print();
  };

  if (loading) {
    return <p className="text-center text-muted-foreground py-12">جارٍ التحميل...</p>;
  }

  const sessionLabel = (session as any)?.excellence_tracks?.track_name || (session as any)?.halaqat?.name || "";
  const sessionHijri = (session as any)?.session_hijri_date;

  const rankedPerformance = calcRanks(
    presentStudentIds.map((id) => performance[id]).filter(Boolean)
  );

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/excellence")}>
            <ArrowRight className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground">
              جلسة التميّز — {sessionHijri ? formatHijriStringArabic(sessionHijri) : ""}
              {session?.session_date && (
                <span className="text-muted-foreground text-base mr-2">
                  ({formatGregorianArabic(session.session_date)})
                </span>
              )}
            </h1>
            <p className="text-sm text-muted-foreground">{sessionLabel}</p>
          </div>
        </div>
        <Button variant="outline" onClick={handlePrint}>
          <Printer className="w-4 h-4 ml-2" />
          طباعة
        </Button>
      </div>

      <Tabs defaultValue="attendance" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="attendance" className="gap-1">
            <Users className="w-4 h-4" />
            التحضير
          </TabsTrigger>
          <TabsTrigger value="performance" className="gap-1">
            <BarChart3 className="w-4 h-4" />
            الأداء
          </TabsTrigger>
          <TabsTrigger value="summary" className="gap-1">
            <ClipboardList className="w-4 h-4" />
            الملخص
          </TabsTrigger>
        </TabsList>

        {/* Attendance Tab */}
        <TabsContent value="attendance">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>تحضير الطلاب</CardTitle>
              {!isSupervisor && (
                <Button onClick={saveAttendance} disabled={saving} size="sm">
                  <Save className="w-4 h-4 ml-2" />
                  حفظ التحضير
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right w-12">#</TableHead>
                    <TableHead className="text-right">الطالب</TableHead>
                    <TableHead className="text-center w-20">حاضر</TableHead>
                    <TableHead className="text-right">ملاحظات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {students.map((s, i) => (
                    <TableRow key={s.id}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell className="font-medium"><StudentNameLink studentId={s.id} studentName={s.full_name} /></TableCell>
                      <TableCell className="text-center">
                        <Checkbox
                          checked={attendance[s.id]?.is_present ?? true}
                          onCheckedChange={(v) => updateAttendance(s.id, "is_present", !!v)}
                          disabled={isSupervisor}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={attendance[s.id]?.notes || ""}
                          onChange={(e) => updateAttendance(s.id, "notes", e.target.value)}
                          placeholder="ملاحظات..."
                          className="h-8 text-sm"
                          disabled={isSupervisor}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>أداء الطلاب الحاضرين</CardTitle>
              {!isSupervisor && (
                <Button onClick={savePerformance} disabled={saving} size="sm">
                  <Save className="w-4 h-4 ml-2" />
                  حفظ الأداء
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {presentStudentIds.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">لا يوجد طلاب حاضرون. احفظ التحضير أولاً.</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-right">#</TableHead>
                        <TableHead className="text-right">الطالب</TableHead>
                        <TableHead className="text-center">الأوجه</TableHead>
                        <TableHead className="text-center">الأحزاب</TableHead>
                        <TableHead className="text-center">الأخطاء</TableHead>
                        <TableHead className="text-center">اللحون</TableHead>
                        <TableHead className="text-center">التنبيهات</TableHead>
                        <TableHead className="text-center">الدرجة</TableHead>
                        <TableHead className="text-center">الترتيب</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {presentStudentIds.map((sid, i) => {
                        const s = students.find((st) => st.id === sid);
                        const p = performance[sid];
                        if (!s || !p) return null;
                        return (
                          <TableRow key={sid}>
                            <TableCell>{i + 1}</TableCell>
                            <TableCell className="font-medium"><StudentNameLink studentId={sid} studentName={s.full_name} /></TableCell>
                            <TableCell>
                              <Input type="number" min={0} value={p.pages_displayed || ""} onChange={(e) => updatePerformance(sid, "pages_displayed", Number(e.target.value))} className="h-8 w-16 text-center mx-auto" disabled={isSupervisor} />
                            </TableCell>
                            <TableCell>
                              <Input type="number" min={0} step={0.5} value={p.hizb_count || ""} onChange={(e) => updatePerformance(sid, "hizb_count", Number(e.target.value))} className="h-8 w-16 text-center mx-auto" disabled={isSupervisor} />
                            </TableCell>
                            <TableCell>
                              <Input type="number" min={0} value={p.mistakes_count || ""} onChange={(e) => updatePerformance(sid, "mistakes_count", Number(e.target.value))} className="h-8 w-16 text-center mx-auto" disabled={isSupervisor} />
                            </TableCell>
                            <TableCell>
                              <Input type="number" min={0} value={p.lahon_count || ""} onChange={(e) => updatePerformance(sid, "lahon_count", Number(e.target.value))} className="h-8 w-16 text-center mx-auto" disabled={isSupervisor} />
                            </TableCell>
                            <TableCell>
                              <Input type="number" min={0} value={p.warnings_count || ""} onChange={(e) => updatePerformance(sid, "warnings_count", Number(e.target.value))} className="h-8 w-16 text-center mx-auto" disabled={isSupervisor} />
                            </TableCell>
                            <TableCell className="text-center font-bold text-lg">
                              {p.total_score.toFixed(1)}
                            </TableCell>
                            <TableCell className="text-center font-bold">
                              {p.rank_in_group || "—"}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Summary Tab */}
        <TabsContent value="summary">
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold">{presentStudentIds.length}</p>
                  <p className="text-sm text-muted-foreground">حاضرون</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold">{students.length - presentStudentIds.length}</p>
                  <p className="text-sm text-muted-foreground">غائبون</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold">
                    {presentStudentIds.reduce((s, id) => s + (performance[id]?.hizb_count || 0), 0)}
                  </p>
                  <p className="text-sm text-muted-foreground">إجمالي الأحزاب</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-2xl font-bold">
                    {presentStudentIds.reduce((s, id) => s + (performance[id]?.pages_displayed || 0), 0)}
                  </p>
                  <p className="text-sm text-muted-foreground">إجمالي الأوجه</p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>ترتيب الطلاب</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-center w-16">الترتيب</TableHead>
                      <TableHead className="text-right">الطالب</TableHead>
                      <TableHead className="text-center">الدرجة</TableHead>
                      <TableHead className="text-center">الأحزاب</TableHead>
                      <TableHead className="text-center">الأوجه</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rankedPerformance.map((p) => {
                      const s = students.find((st) => st.id === p.student_id);
                      return (
                        <TableRow key={p.student_id}>
                          <TableCell className="text-center font-bold text-primary">{p.rank_in_group}</TableCell>
                          <TableCell className="font-medium"><StudentNameLink studentId={p.student_id} studentName={s?.full_name || "—"} /></TableCell>
                          <TableCell className="text-center font-bold">{p.total_score.toFixed(1)}</TableCell>
                          <TableCell className="text-center">{p.hizb_count}</TableCell>
                          <TableCell className="text-center">{p.pages_displayed}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Hidden Print Template */}
      <div className="hidden">
        <div ref={printRef}>
          <ExcellencePrintTemplate
            session={session}
            students={students}
            attendance={attendance}
            rankedPerformance={rankedPerformance}
          />
        </div>
      </div>
    </div>
  );
}
