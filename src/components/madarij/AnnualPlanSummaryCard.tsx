import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { CalendarDays, ArrowLeft } from "lucide-react";

const PLAN_LABELS: Record<string, string> = {
  silver: "🥈 فضي",
  gold: "🥇 ذهبي",
  custom: "⚙️ مخصص",
};

const AnnualPlanSummaryCard = ({ studentId }: { studentId: string }) => {
  const navigate = useNavigate();
  const [plan, setPlan] = useState<any>(null);
  const [progress, setProgress] = useState<any[]>([]);

  useEffect(() => {
    const fetch = async () => {
      const { data: plans } = await supabase
        .from("student_annual_plans")
        .select("*")
        .eq("student_id", studentId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1);

      const p = plans?.[0];
      if (!p) return;
      setPlan(p);

      const { data: prog } = await supabase
        .from("student_plan_progress")
        .select("actual_pages, target_pages, month_number")
        .eq("plan_id", p.id)
        .order("month_number");
      setProgress(prog || []);
    };
    fetch();
  }, [studentId]);

  if (!plan) return null;

  const totalActual = progress.reduce((s, p) => s + (p.actual_pages || 0), 0);
  const totalTarget = plan.total_target_pages || 0;
  const pct = totalTarget > 0 ? Math.round((totalActual / totalTarget) * 100) : 0;

  // Current month commitment
  const now = new Date();
  const monthsElapsed = progress.filter((_, i) => i < Math.min(progress.length, Math.ceil((now.getTime() - new Date(plan.start_date).getTime()) / (30 * 86400000)))).length || 1;
  const expectedPages = progress.slice(0, monthsElapsed).reduce((s, p) => s + p.target_pages, 0);
  const commitPct = expectedPages > 0 ? Math.round((totalActual / expectedPages) * 100) : 100;

  const statusLabel = commitPct >= 100 ? "🚀 متقدم" : commitPct >= 85 ? "✅ على المسار" : "⚠️ متأخر";
  const statusColor = commitPct >= 100 ? "text-primary" : commitPct >= 85 ? "text-success" : "text-warning";

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-primary" />
          الخطة السنوية
        </CardTitle>
        <Button variant="ghost" size="sm" onClick={() => navigate(`/student-annual-plan/${studentId}`)}>
          عرض الخطة <ArrowLeft className="w-4 h-4 mr-1" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary">{PLAN_LABELS[plan.plan_type] || plan.plan_type}</Badge>
          <Badge variant="outline">{plan.academic_year}</Badge>
          <span className={`text-xs font-medium ${statusColor}`}>{statusLabel}</span>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-xs">
            <span>الإنجاز: {totalActual} / {totalTarget} وجه</span>
            <span className="font-bold">{pct}%</span>
          </div>
          <Progress value={pct} className="h-2" />
        </div>
        <div className="text-xs text-muted-foreground">
          نسبة الالتزام الشهري: <span className={`font-bold ${statusColor}`}>{commitPct}%</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default AnnualPlanSummaryCard;
