import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, ArrowLeft, Check } from "lucide-react";

interface Props {
  studentId: string;
  onApply: (from: string, to: string) => void;
}

const StudentAnnualPlanCard = ({ studentId, onApply }: Props) => {
  const [plan, setPlan] = useState<any>(null);
  const [lastRecord, setLastRecord] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [applied, setApplied] = useState(false);

  useEffect(() => {
    setApplied(false);
    setLoading(true);
    
    const fetchData = async () => {
      // Fetch active annual plan
      const { data: plans } = await supabase
        .from("student_annual_plans")
        .select("*")
        .eq("student_id", studentId)
        .eq("status", "active")
        .limit(1);

      const activePlan = plans?.[0] || null;
      setPlan(activePlan);

      // Fetch last recitation record
      const { data: records } = await supabase
        .from("recitation_records")
        .select("memorized_to, record_date")
        .eq("student_id", studentId)
        .not("memorized_to", "is", null)
        .order("record_date", { ascending: false })
        .limit(1);

      setLastRecord(records?.[0] || null);
      setLoading(false);
    };

    fetchData();
  }, [studentId]);

  if (loading || !plan) return null;

  const dailyTarget = Number(plan.daily_target_pages) || 0.5;
  const startFrom = lastRecord?.memorized_to || "بداية المقرر";

  const handleApply = () => {
    const from = lastRecord?.memorized_to || "";
    onApply(from, `+${dailyTarget} وجه`);
    setApplied(true);
  };

  return (
    <Card className="border-green-300 bg-green-50 dark:bg-green-950/30 dark:border-green-800">
      <CardContent className="p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <BookOpen className="w-4 h-4 text-green-600 shrink-0" />
            <div className="text-sm min-w-0">
              <p className="font-semibold text-green-800 dark:text-green-300">
                الهدف اليوم: {dailyTarget} وجه
              </p>
              <p className="text-xs text-green-700 dark:text-green-400 truncate">
                من: {startFrom}
                <ArrowLeft className="w-3 h-3 inline mx-1" />
                إلى: +{dailyTarget} وجه
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant={applied ? "secondary" : "default"}
            className="shrink-0 text-xs h-7"
            onClick={handleApply}
            disabled={applied}
          >
            {applied ? <><Check className="w-3 h-3 ml-1" />تم</> : "تطبيق"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default StudentAnnualPlanCard;
