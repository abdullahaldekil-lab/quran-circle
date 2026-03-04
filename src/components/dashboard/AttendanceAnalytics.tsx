import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTeacherHalaqat } from "@/hooks/useTeacherHalaqat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { CalendarCheck, AlertTriangle } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

const AttendanceAnalytics = () => {
  const { user } = useAuth();
  const { allowedHalaqatIds, loading: accessLoading } = useTeacherHalaqat();
  const [weeklyRate, setWeeklyRate] = useState(0);
  const [dailyData, setDailyData] = useState<{ day: string; rate: number }[]>([]);
  const [frequentAbsences, setFrequentAbsences] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || accessLoading) return;
    if (allowedHalaqatIds !== null && allowedHalaqatIds.length === 0) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const today = new Date();
        // Last 7 calendar days
        const days: string[] = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date(today);
          d.setDate(today.getDate() - i);
          days.push(d.toISOString().split("T")[0]);
        }

        const firstDay = days[0];
        const lastDay = days[days.length - 1];

        let query = supabase
          .from("attendance")
          .select("attendance_date, status, student_id")
          .gte("attendance_date", firstDay)
          .lte("attendance_date", lastDay);

        if (allowedHalaqatIds !== null && allowedHalaqatIds.length > 0) {
          query = query.in("halaqa_id", allowedHalaqatIds);
        }

        const { data: records } = await query;
        const rows = records || [];

        // Daily rates
        const dailyRates = days.map((date) => {
          const dayRows = rows.filter((r) => r.attendance_date === date);
          const present = dayRows.filter((r) => r.status === "present" || r.status === "late").length;
          const total = dayRows.length;
          const rate = total > 0 ? Math.round((present / total) * 100) : 0;
          const d = new Date(date);
          const dayName = d.toLocaleDateString("ar-SA", { weekday: "short" });
          return { day: dayName, rate };
        });
        setDailyData(dailyRates);

        // Weekly overall rate
        const totalRecords = rows.length;
        const totalPresent = rows.filter((r) => r.status === "present" || r.status === "late").length;
        setWeeklyRate(totalRecords > 0 ? Math.round((totalPresent / totalRecords) * 100) : 0);

        // Frequent absences this month (students absent > 3 times)
        const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0];
        let monthQuery = supabase
          .from("attendance")
          .select("student_id, status")
          .gte("attendance_date", firstOfMonth)
          .eq("status", "absent");

        if (allowedHalaqatIds !== null && allowedHalaqatIds.length > 0) {
          monthQuery = monthQuery.in("halaqa_id", allowedHalaqatIds);
        }

        const { data: absentRows } = await monthQuery;
        const absentMap: Record<string, number> = {};
        (absentRows || []).forEach((r) => {
          absentMap[r.student_id] = (absentMap[r.student_id] || 0) + 1;
        });
        const frequent = Object.values(absentMap).filter((c) => c > 3).length;
        setFrequentAbsences(frequent);
      } catch (e) {
        console.error("AttendanceAnalytics error:", e);
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
      <h2 className="text-lg font-bold text-foreground">📅 تحليلات الحضور</h2>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Weekly attendance rate */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">نسبة الحضور الأسبوعية</CardTitle>
            <CalendarCheck className="w-5 h-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold mb-2">{weeklyRate}%</div>
            <Progress value={weeklyRate} className="h-2.5" />
          </CardContent>
        </Card>

        {/* Frequent absences */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">غيابات متكررة</CardTitle>
            <AlertTriangle className="w-5 h-5 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{frequentAbsences}</div>
            <p className="text-xs text-muted-foreground mt-1">طلاب غابوا أكثر من 3 مرات هذا الشهر</p>
          </CardContent>
        </Card>
      </div>

      {/* Daily line chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">الحضور اليومي – آخر 7 أيام</CardTitle>
        </CardHeader>
        <CardContent>
          {dailyData.every((d) => d.rate === 0) ? (
            <p className="text-sm text-muted-foreground text-center py-8">لا توجد بيانات حضور</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={dailyData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} unit="%" />
                <Tooltip
                  formatter={(value: number) => [`${value}%`, "نسبة الحضور"]}
                  contentStyle={{ borderRadius: "8px", fontSize: "13px", direction: "rtl" }}
                />
                <Line
                  type="monotone"
                  dataKey="rate"
                  stroke="hsl(155, 55%, 28%)"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: "hsl(155, 55%, 28%)" }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AttendanceAnalytics;
