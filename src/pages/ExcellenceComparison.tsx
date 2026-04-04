import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from "recharts";
import { toast } from "@/hooks/use-toast";
import PageDateHeader from "@/components/PageDateHeader";
import { Scale, Users, Trophy, BookOpen, Eye, AlertCircle, Music } from "lucide-react";

const PERIOD_OPTIONS = [
  { value: "1", label: "آخر شهر" },
  { value: "3", label: "آخر 3 أشهر" },
  { value: "6", label: "آخر 6 أشهر" },
  { value: "12", label: "السنة كاملة" },
];

const COLORS = ["#8b5cf6", "#06b6d4", "#f59e0b", "#ef4444", "#10b981", "#ec4899"];

interface ComparisonData {
  studentId: string;
  studentName: string;
  avgScore: number;
  attendanceRate: number;
  totalPages: number;
  totalHizb: number;
  avgMistakes: number;
  avgRecitationScore: number;
}

const ExcellenceComparison = () => {
  const [trackId, setTrackId] = useState<string>("");
  const [period, setPeriod] = useState<string>("3");
  const [selectedStudents, setSelectedStudents] = useState<string[]>([]);
  const [comparisonData, setComparisonData] = useState<ComparisonData[]>([]);
  const [isComparing, setIsComparing] = useState(false);

  const { data: tracks } = useQuery({
    queryKey: ["excellence-tracks"],
    queryFn: async () => {
      const { data } = await supabase.from("excellence_tracks").select("id, track_name").eq("is_active", true);
      return data || [];
    },
  });

  const { data: eliteStudents } = useQuery({
    queryKey: ["elite-students-for-comparison", trackId],
    queryFn: async () => {
      if (!trackId) return [];
      const { data } = await supabase
        .from("excellence_elite_students")
        .select("student_id, students:student_id(id, full_name, halaqa_id)")
        .eq("halaqa_id", trackId);
      
      // If no results by halaqa_id, try getting all elite students
      if (!data || data.length === 0) {
        const { data: allElite } = await supabase
          .from("excellence_elite_students")
          .select("student_id, students:student_id(id, full_name, halaqa_id)");
        return allElite || [];
      }
      return data || [];
    },
    enabled: !!trackId,
  });

  const toggleStudent = (studentId: string) => {
    setSelectedStudents((prev) => {
      if (prev.includes(studentId)) return prev.filter((id) => id !== studentId);
      if (prev.length >= 6) {
        toast({ title: "الحد الأقصى 6 طلاب", variant: "destructive" });
        return prev;
      }
      return [...prev, studentId];
    });
  };

  const handleCompare = async () => {
    if (selectedStudents.length < 2) {
      toast({ title: "يرجى اختيار طالبين على الأقل", variant: "destructive" });
      return;
    }

    setIsComparing(true);
    const monthsAgo = new Date();
    monthsAgo.setMonth(monthsAgo.getMonth() - parseInt(period));
    const startDate = monthsAgo.toISOString().split("T")[0];

    try {
      const results: ComparisonData[] = [];

      for (const studentId of selectedStudents) {
        // Get student name
        const student = eliteStudents?.find((e: any) => {
          const s = e.students as any;
          return s?.id === studentId;
        });
        const studentName = (student?.students as any)?.full_name || "غير معروف";

        // 1. Excellence performance (avg score, total pages, total hizb, avg mistakes)
        const { data: perfData } = await supabase
          .from("excellence_performance")
          .select("total_score, pages_displayed, hizb_count, mistakes_count, session_id")
          .eq("student_id", studentId);

        // Filter by sessions within the period
        const { data: sessions } = await supabase
          .from("excellence_sessions")
          .select("id, session_date")
          .gte("session_date", startDate);

        const sessionIds = new Set(sessions?.map((s) => s.id) || []);
        const filteredPerf = perfData?.filter((p) => sessionIds.has(p.session_id)) || [];

        const avgScore = filteredPerf.length > 0
          ? filteredPerf.reduce((sum, p) => sum + (Number(p.total_score) || 0), 0) / filteredPerf.length
          : 0;
        const totalPages = filteredPerf.reduce((sum, p) => sum + (Number(p.pages_displayed) || 0), 0);
        const totalHizb = filteredPerf.reduce((sum, p) => sum + (Number(p.hizb_count) || 0), 0);
        const avgMistakes = filteredPerf.length > 0
          ? filteredPerf.reduce((sum, p) => sum + (Number(p.mistakes_count) || 0), 0) / filteredPerf.length
          : 0;

        // 2. Attendance rate
        const { data: attendanceData } = await supabase
          .from("excellence_attendance")
          .select("is_present, session_id")
          .eq("student_id", studentId);

        const filteredAtt = attendanceData?.filter((a) => sessionIds.has(a.session_id)) || [];
        const attendanceRate = filteredAtt.length > 0
          ? (filteredAtt.filter((a) => a.is_present).length / filteredAtt.length) * 100
          : 0;

        // 3. Recitation score
        const { data: recitationData } = await supabase
          .from("recitation_records" as any)
          .select("total_score")
          .eq("student_id", studentId)
          .gte("record_date", startDate);

        const recArr = (recitationData as any[]) || [];
        const avgRecitationScore = recArr.length > 0
          ? recArr.reduce((sum: number, r: any) => sum + (Number(r.total_score) || 0), 0) / recArr.length
          : 0;

        results.push({
          studentId,
          studentName,
          avgScore: Math.round(avgScore * 10) / 10,
          attendanceRate: Math.round(attendanceRate * 10) / 10,
          totalPages: Math.round(totalPages * 10) / 10,
          totalHizb: Math.round(totalHizb * 10) / 10,
          avgMistakes: Math.round(avgMistakes * 10) / 10,
          avgRecitationScore: Math.round(avgRecitationScore * 10) / 10,
        });
      }

      setComparisonData(results);
    } catch (error) {
      console.error(error);
      toast({ title: "حدث خطأ أثناء المقارنة", variant: "destructive" });
    } finally {
      setIsComparing(false);
    }
  };

  // Radar chart data
  const radarData = useMemo(() => {
    if (comparisonData.length === 0) return [];
    
    // Normalize values for radar (0-100 scale)
    const maxPages = Math.max(...comparisonData.map((d) => d.totalPages), 1);
    const maxHizb = Math.max(...comparisonData.map((d) => d.totalHizb), 1);
    const maxMistakes = Math.max(...comparisonData.map((d) => d.avgMistakes), 1);

    const axes = [
      { axis: "درجة التميز", key: "avgScore" },
      { axis: "الحضور %", key: "attendanceRate" },
      { axis: "الأوجه", key: "totalPages" },
      { axis: "الأحزاب", key: "totalHizb" },
      { axis: "قلة الأخطاء", key: "mistakes" },
      { axis: "درجة التسميع", key: "avgRecitationScore" },
    ];

    return axes.map((a) => {
      const point: any = { axis: a.axis };
      comparisonData.forEach((d) => {
        let val = 0;
        switch (a.key) {
          case "avgScore": val = d.avgScore; break;
          case "attendanceRate": val = d.attendanceRate; break;
          case "totalPages": val = (d.totalPages / maxPages) * 100; break;
          case "totalHizb": val = (d.totalHizb / maxHizb) * 100; break;
          case "mistakes": val = maxMistakes > 0 ? ((maxMistakes - d.avgMistakes) / maxMistakes) * 100 : 100; break;
          case "avgRecitationScore": val = d.avgRecitationScore; break;
        }
        point[d.studentName] = Math.round(val * 10) / 10;
      });
      return point;
    });
  }, [comparisonData]);

  // Bar chart data
  const barData = useMemo(() => {
    return comparisonData.map((d) => ({
      name: d.studentName.length > 12 ? d.studentName.substring(0, 12) + "…" : d.studentName,
      "درجة التميز": d.avgScore,
      "الحضور %": d.attendanceRate,
      "درجة التسميع": d.avgRecitationScore,
    }));
  }, [comparisonData]);

  return (
    <div className="p-4 md:p-6 space-y-6" dir="rtl">
      <h1 className="text-2xl font-bold">مقارنة المتميزين</h1>
      <PageDateHeader />

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Scale className="h-5 w-5" />
            فلاتر المقارنة
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>المسار</Label>
              <Select value={trackId} onValueChange={(v) => { setTrackId(v); setSelectedStudents([]); setComparisonData([]); }}>
                <SelectTrigger><SelectValue placeholder="اختر المسار" /></SelectTrigger>
                <SelectContent>
                  {tracks?.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.track_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>الفترة الزمنية</Label>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PERIOD_OPTIONS.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={handleCompare} disabled={isComparing || selectedStudents.length < 2} className="w-full">
                {isComparing ? "جارٍ المقارنة..." : "مقارنة"}
              </Button>
            </div>
          </div>

          {/* Student Selection */}
          {trackId && (
            <div className="space-y-2">
              <Label>اختر الطلاب للمقارنة (2 - 6)</Label>
              <div className="flex flex-wrap gap-3 p-3 border rounded-lg bg-muted/30 max-h-48 overflow-y-auto">
                {eliteStudents && eliteStudents.length > 0 ? (
                  eliteStudents.map((e: any) => {
                    const student = e.students as any;
                    if (!student) return null;
                    const isSelected = selectedStudents.includes(student.id);
                    return (
                      <div key={student.id} className="flex items-center gap-2">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleStudent(student.id)}
                          id={`student-${student.id}`}
                        />
                        <label htmlFor={`student-${student.id}`} className="text-sm cursor-pointer">
                          {student.full_name}
                        </label>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-muted-foreground">لا يوجد طلاب مميزون في هذا المسار</p>
                )}
              </div>
              {selectedStudents.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {selectedStudents.map((id, i) => {
                    const student = eliteStudents?.find((e: any) => (e.students as any)?.id === id);
                    return (
                      <Badge key={id} variant="secondary" style={{ borderColor: COLORS[i] }} className="border-2">
                        {(student?.students as any)?.full_name}
                      </Badge>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {comparisonData.length > 0 && (
        <>
          {/* Radar Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">مخطط المقارنة الشاملة (رادار)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="axis" className="text-xs" />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} />
                  {comparisonData.map((d, i) => (
                    <Radar
                      key={d.studentId}
                      name={d.studentName}
                      dataKey={d.studentName}
                      stroke={COLORS[i]}
                      fill={COLORS[i]}
                      fillOpacity={0.15}
                    />
                  ))}
                  <Legend />
                  <Tooltip />
                </RadarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Bar Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">مقارنة الدرجات</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={barData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="درجة التميز" fill="#8b5cf6" />
                  <Bar dataKey="الحضور %" fill="#06b6d4" />
                  <Bar dataKey="درجة التسميع" fill="#f59e0b" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Comparison Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">جدول المقارنة التفصيلي</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">المحور</TableHead>
                      {comparisonData.map((d, i) => (
                        <TableHead key={d.studentId} className="text-center" style={{ color: COLORS[i] }}>
                          {d.studentName}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[
                      { label: "درجة التميز", key: "avgScore", icon: <Trophy className="h-4 w-4 inline ml-1" />, best: "max" },
                      { label: "الحضور %", key: "attendanceRate", icon: <Users className="h-4 w-4 inline ml-1" />, best: "max" },
                      { label: "الأوجه المسرودة", key: "totalPages", icon: <Eye className="h-4 w-4 inline ml-1" />, best: "max" },
                      { label: "الأحزاب المسرودة", key: "totalHizb", icon: <BookOpen className="h-4 w-4 inline ml-1" />, best: "max" },
                      { label: "متوسط الأخطاء", key: "avgMistakes", icon: <AlertCircle className="h-4 w-4 inline ml-1" />, best: "min" },
                      { label: "درجة التسميع", key: "avgRecitationScore", icon: <Music className="h-4 w-4 inline ml-1" />, best: "max" },
                    ].map((row) => {
                      const values = comparisonData.map((d) => (d as any)[row.key] as number);
                      const bestVal = row.best === "max" ? Math.max(...values) : Math.min(...values);
                      return (
                        <TableRow key={row.key}>
                          <TableCell className="font-medium text-right">
                            {row.icon} {row.label}
                          </TableCell>
                          {comparisonData.map((d) => {
                            const val = (d as any)[row.key] as number;
                            const isBest = val === bestVal && comparisonData.length > 1;
                            return (
                              <TableCell key={d.studentId} className={`text-center font-semibold ${isBest ? "text-green-600 bg-green-50" : ""}`}>
                                {val}
                                {isBest && <span className="mr-1">⭐</span>}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default ExcellenceComparison;
