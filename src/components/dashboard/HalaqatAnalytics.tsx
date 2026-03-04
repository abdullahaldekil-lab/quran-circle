import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTeacherHalaqat } from "@/hooks/useTeacherHalaqat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BookOpen } from "lucide-react";

interface HalaqaRow {
  name: string;
  studentCount: number;
  attendanceRate: number;
  avgScore: number;
}

const HalaqatAnalytics = () => {
  const { user } = useAuth();
  const { allowedHalaqatIds, loading: accessLoading } = useTeacherHalaqat();
  const [rows, setRows] = useState<HalaqaRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || accessLoading) return;
    if (allowedHalaqatIds !== null && allowedHalaqatIds.length === 0) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        // Get halaqat
        let hQuery = supabase.from("halaqat").select("id, name").eq("active", true);
        if (allowedHalaqatIds !== null && allowedHalaqatIds.length > 0) {
          hQuery = hQuery.in("id", allowedHalaqatIds);
        }
        const { data: halaqat } = await hQuery;
        if (!halaqat?.length) { setLoading(false); return; }

        const ids = halaqat.map((h) => h.id);

        // Students count per halaqa
        const { data: students } = await supabase
          .from("students")
          .select("halaqa_id")
          .eq("status", "active")
          .in("halaqa_id", ids);

        // Attendance this month
        const firstOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0];
        const { data: attendance } = await supabase
          .from("attendance")
          .select("halaqa_id, status")
          .gte("attendance_date", firstOfMonth)
          .in("halaqa_id", ids);

        // Recitation scores this month
        const { data: recitations } = await supabase
          .from("recitation_records")
          .select("halaqa_id, total_score")
          .gte("record_date", firstOfMonth)
          .in("halaqa_id", ids);

        const result: HalaqaRow[] = halaqat.map((h) => {
          const sCount = (students || []).filter((s) => s.halaqa_id === h.id).length;
          const hAttendance = (attendance || []).filter((a) => a.halaqa_id === h.id);
          const present = hAttendance.filter((a) => a.status === "present" || a.status === "late").length;
          const attRate = hAttendance.length > 0 ? Math.round((present / hAttendance.length) * 100) : 0;
          const scores = (recitations || []).filter((r) => r.halaqa_id === h.id).map((r) => Number(r.total_score)).filter(Boolean);
          const avg = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
          return { name: h.name, studentCount: sCount, attendanceRate: attRate, avgScore: avg };
        });

        result.sort((a, b) => b.avgScore - a.avgScore);
        setRows(result);
      } catch (e) {
        console.error("HalaqatAnalytics error:", e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user, accessLoading, allowedHalaqatIds]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
        <BookOpen className="w-5 h-5 text-primary" /> تحليلات الحلقات
      </h2>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">مقارنة بين الحلقات – هذا الشهر</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8 px-4">لا توجد بيانات</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الحلقة</TableHead>
                  <TableHead className="text-center">عدد الطلاب</TableHead>
                  <TableHead className="text-center">نسبة الحضور</TableHead>
                  <TableHead className="text-center">متوسط الدرجات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.name}>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="text-center">{row.studentCount}</TableCell>
                    <TableCell className="text-center">
                      <span className={`font-semibold ${row.attendanceRate >= 80 ? "text-success" : row.attendanceRate >= 60 ? "text-warning" : "text-destructive"}`}>
                        {row.attendanceRate}%
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={`font-semibold ${row.avgScore >= 80 ? "text-success" : row.avgScore >= 60 ? "text-warning" : "text-destructive"}`}>
                        {row.avgScore}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default HalaqatAnalytics;
