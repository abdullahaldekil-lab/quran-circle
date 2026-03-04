import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTeacherHalaqat } from "@/hooks/useTeacherHalaqat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, UserPlus, TrendingUp, TrendingDown } from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";

const COLORS = {
  active: "hsl(145, 60%, 40%)",
  inactive: "hsl(0, 72%, 51%)",
  primary: "hsl(155, 55%, 28%)",
  secondary: "hsl(42, 75%, 55%)",
  accent: "hsl(200, 60%, 50%)",
};

const StudentAnalytics = () => {
  const { user } = useAuth();
  const { allowedHalaqatIds, loading: accessLoading } = useTeacherHalaqat();
  const [data, setData] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    newThisMonth: 0,
    lastMonthTotal: 0,
    levelDistribution: [] as { name: string; count: number }[],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || accessLoading) return;

    const fetch = async () => {
      try {
        const now = new Date();
        const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const firstOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).toISOString();

        const applyFilter = (q: any) => {
          if (allowedHalaqatIds !== null && allowedHalaqatIds.length > 0) {
            return q.in("halaqa_id", allowedHalaqatIds);
          }
          return q;
        };

        if (allowedHalaqatIds !== null && allowedHalaqatIds.length === 0) {
          setLoading(false);
          return;
        }

        // Parallel queries
        const [activeRes, inactiveRes, newRes, lastMonthRes, levelsRes] = await Promise.all([
          applyFilter(supabase.from("students").select("id", { count: "exact", head: true }).eq("status", "active")),
          applyFilter(supabase.from("students").select("id", { count: "exact", head: true }).eq("status", "inactive")),
          applyFilter(supabase.from("students").select("id", { count: "exact", head: true }).eq("status", "active").gte("created_at", firstOfMonth)),
          applyFilter(supabase.from("students").select("id", { count: "exact", head: true }).gte("created_at", firstOfLastMonth).lte("created_at", endOfLastMonth)),
          applyFilter(supabase.from("students").select("current_level").eq("status", "active")),
        ]);

        const activeCount = activeRes.count || 0;
        const inactiveCount = inactiveRes.count || 0;

        // Level distribution
        const levelMap: Record<string, number> = {};
        (levelsRes.data || []).forEach((s: any) => {
          const name = s.memorization_levels?.name || "غير محدد";
          levelMap[name] = (levelMap[name] || 0) + 1;
        });

        setData({
          total: activeCount + inactiveCount,
          active: activeCount,
          inactive: inactiveCount,
          newThisMonth: newRes.count || 0,
          lastMonthTotal: lastMonthRes.count || 0,
          levelDistribution: Object.entries(levelMap).map(([name, count]) => ({ name, count })),
        });
      } catch (e) {
        console.error("StudentAnalytics error:", e);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [user, accessLoading, allowedHalaqatIds]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const growthPercent = data.lastMonthTotal > 0
    ? Math.round(((data.newThisMonth - data.lastMonthTotal) / data.lastMonthTotal) * 100)
    : data.newThisMonth > 0 ? 100 : 0;

  const donutData = [
    { name: "نشط", value: data.active },
    { name: "غير نشط", value: data.inactive },
  ];

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-foreground">📊 تحليلات الطلاب</h2>

      {/* Top summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">إجمالي الطلاب</CardTitle>
            <Users className="w-5 h-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.total}</div>
            <div className={`flex items-center gap-1 text-xs mt-1 ${growthPercent >= 0 ? "text-success" : "text-destructive"}`}>
              {growthPercent >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              <span>{growthPercent >= 0 ? "+" : ""}{growthPercent}% عن الشهر الماضي</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">الطلاب الجدد</CardTitle>
            <UserPlus className="w-5 h-5 text-secondary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.newThisMonth}</div>
            <p className="text-xs text-muted-foreground mt-1">هذا الشهر</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">نشطون</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{data.active}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">غير نشطين</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{data.inactive}</div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Donut Chart - Active vs Inactive */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">النشطون مقابل غير النشطين</CardTitle>
          </CardHeader>
          <CardContent>
            {data.total === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">لا توجد بيانات</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    dataKey="value"
                    stroke="none"
                  >
                    <Cell fill={COLORS.active} />
                    <Cell fill={COLORS.inactive} />
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string) => [`${value} طالب`, name]}
                    contentStyle={{ borderRadius: "8px", fontSize: "13px", direction: "rtl" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
            <div className="flex justify-center gap-6 mt-2 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.active }} />
                <span>نشط ({data.active})</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.inactive }} />
                <span>غير نشط ({data.inactive})</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bar Chart - Level Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">توزيع الطلاب حسب المستوى</CardTitle>
          </CardHeader>
          <CardContent>
            {data.levelDistribution.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">لا توجد بيانات</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.levelDistribution} layout="vertical" margin={{ right: 10, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value: number) => [`${value} طالب`]}
                    contentStyle={{ borderRadius: "8px", fontSize: "13px", direction: "rtl" }}
                  />
                  <Bar dataKey="count" fill={COLORS.primary} radius={[0, 4, 4, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default StudentAnalytics;
