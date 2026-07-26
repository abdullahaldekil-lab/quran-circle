import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, ArrowLeft, Check, BookOpenCheck } from "lucide-react";
import MushafViewer from "@/components/mushaf/MushafViewer";
import { nextDailyMushafRange, pageToJuz, parsePageRef } from "@/lib/mushaf";

interface Props {
  studentId: string;
  onApply: (from: string, to: string) => void;
  /** Auto-fill the recitation form with the computed daily range (default: true). */
  autoApply?: boolean;
}

const StudentAnnualPlanCard = ({ studentId, onApply, autoApply = true }: Props) => {
  const [plan, setPlan] = useState<any>(null);
  const [lastRecord, setLastRecord] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [applied, setApplied] = useState(false);
  const [mushafOpen, setMushafOpen] = useState(false);
  const autoAppliedFor = useRef<string>("");

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

  const dailyTarget = Number(plan?.daily_memorization_pages ?? plan?.daily_target_pages) || 1;

  /** آخر موضع للطالب: آخر تسميع، وإلا نهاية المحفوظ السابق في الخطة */
  const lastRef: string | null =
    lastRecord?.memorized_to || plan?.previous_memorized_to || null;

  const range = useMemo(
    () => (plan ? nextDailyMushafRange(lastRef, dailyTarget) : null),
    [plan, lastRef, dailyTarget],
  );

  // تحديد بداية ونهاية الجزء تلقائياً في الخطة اليومية
  useEffect(() => {
    if (!autoApply || !range || applied) return;
    const key = `${studentId}:${range.from}-${range.to}`;
    if (autoAppliedFor.current === key) return;
    autoAppliedFor.current = key;
    onApply(range.fromLabel, range.toLabel);
    setApplied(true);
  }, [autoApply, range, applied, studentId, onApply]);

  if (loading || !plan || !range) return null;

  const currentPage = parsePageRef(lastRef) ?? range.from;

  const handleApply = () => {
    onApply(range.fromLabel, range.toLabel);
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
                {range.juzFrom === range.juzTo
                  ? ` — الجزء ${range.juzFrom}`
                  : ` — الأجزاء ${range.juzFrom} إلى ${range.juzTo}`}
              </p>
              <p className="text-xs text-green-700 dark:text-green-400 truncate">
                من: {range.fromLabel}
                <ArrowLeft className="w-3 h-3 inline mx-1" />
                إلى: {range.toLabel}
              </p>
              <p className="text-[11px] text-green-600 dark:text-green-500">
                {range.completed
                  ? "أتم الطالب نطاق الخطة"
                  : `تم التحديد تلقائياً بناءً على آخر تسميع (${
                      lastRef ? `الجزء ${pageToJuz(currentPage)}` : "بداية المقرر"
                    })`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button size="sm" variant="ghost" className="text-xs h-7" onClick={() => setMushafOpen(true)}>
              <BookOpenCheck className="w-3 h-3 ml-1" />المصحف
            </Button>
            <Button
              size="sm"
              variant={applied ? "secondary" : "default"}
              className="text-xs h-7"
              onClick={handleApply}
              disabled={applied}
            >
              {applied ? <><Check className="w-3 h-3 ml-1" />تم</> : "تطبيق"}
            </Button>
          </div>
        </div>
      </CardContent>
      <MushafViewer
        open={mushafOpen}
        onOpenChange={setMushafOpen}
        title="المصحف — الخطة السنوية"
        currentPage={range.from}
        todayFrom={range.from}
        todayTo={range.to}
      />
    </Card>
  );
};

export default StudentAnnualPlanCard;
