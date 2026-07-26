import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, ArrowLeft, Check, BookOpenCheck, Link2, RefreshCw } from "lucide-react";
import MushafViewer from "@/components/mushaf/MushafViewer";
import {
  nextDailyMushafRange,
  nextLinkingMushafRange,
  nextReviewMushafRange,
  pageToJuz,
  parsePageRef,
} from "@/lib/mushaf";
import { activePlanFor, termLabel } from "@/lib/planTerm";

export interface SuggestedRanges {
  memorized_from: string;
  memorized_to: string;
  review_from: string;
  review_to: string;
  linking_from: string;
  linking_to: string;
}

interface Props {
  studentId: string;
  onApply: (ranges: SuggestedRanges) => void;
  /** Auto-fill the recitation form with the computed daily ranges (default: true). */
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
      // Terms mean a student can legitimately have more than one active plan
      // (annual + summer, say), so pick the one that covers today rather than
      // whichever row comes back first.
      const { data: plans } = await supabase
        .from("student_annual_plans")
        .select("*")
        .eq("student_id", studentId)
        .eq("status", "active");

      const today = new Date().toISOString().split("T")[0];
      setPlan(activePlanFor((plans as any[]) || [], today));

      // Last recitation, for the position of each of the three sections
      const { data: records } = await supabase
        .from("recitation_records")
        .select("memorized_to, review_to, linking_to, record_date")
        .eq("student_id", studentId)
        .order("record_date", { ascending: false })
        .limit(20);

      const list = (records as any[]) || [];
      setLastRecord({
        memorized_to: list.find((r) => r.memorized_to)?.memorized_to ?? null,
        review_to: list.find((r) => r.review_to)?.review_to ?? null,
        linking_to: list.find((r) => r.linking_to)?.linking_to ?? null,
      });
      setLoading(false);
    };

    fetchData();
  }, [studentId]);

  const dailyTarget = Number(plan?.daily_memorization_pages ?? plan?.daily_target_pages) || 1;
  const dailyReview = Number(plan?.daily_review_pages) || 0;
  const dailyLinking = Number(plan?.daily_linking_pages) || 0;

  /** آخر موضع للطالب: آخر تسميع، وإلا نهاية المحفوظ السابق في الخطة */
  const lastRef: string | null =
    lastRecord?.memorized_to || plan?.previous_memorized_to || null;

  const suggestion = useMemo(() => {
    if (!plan) return null;
    const memorization = nextDailyMushafRange(lastRef, dailyTarget);

    // Review sweeps what the student has already memorized, up to the page before
    // today's new portion.
    const memorizedEnd = (parsePageRef(lastRef) ?? memorization.from) - 1;
    const review =
      dailyReview > 0
        ? nextReviewMushafRange(lastRecord?.review_to, dailyReview, {
            start: parsePageRef(plan?.previous_memorized_from) ?? 1,
            end: memorizedEnd,
          })
        : null;

    // Linking joins the tail of the previous portion to today's new one.
    const linking =
      dailyLinking > 0 ? nextLinkingMushafRange(memorization.from, dailyLinking) : null;

    return { memorization, review, linking };
  }, [plan, lastRef, dailyTarget, dailyReview, dailyLinking, lastRecord]);

  const ranges: SuggestedRanges | null = useMemo(() => {
    if (!suggestion) return null;
    return {
      memorized_from: suggestion.memorization.fromLabel,
      memorized_to: suggestion.memorization.toLabel,
      review_from: suggestion.review?.fromLabel ?? "",
      review_to: suggestion.review?.toLabel ?? "",
      linking_from: suggestion.linking?.fromLabel ?? "",
      linking_to: suggestion.linking?.toLabel ?? "",
    };
  }, [suggestion]);

  // تحديد بداية ونهاية الجزء تلقائياً في الخطة اليومية
  useEffect(() => {
    if (!autoApply || !ranges || applied) return;
    const key = `${studentId}:${Object.values(ranges).join("|")}`;
    if (autoAppliedFor.current === key) return;
    autoAppliedFor.current = key;
    onApply(ranges);
    setApplied(true);
  }, [autoApply, ranges, applied, studentId, onApply]);

  if (loading || !plan || !suggestion || !ranges) return null;

  const { memorization, review, linking } = suggestion;
  const currentPage = parsePageRef(lastRef) ?? memorization.from;

  const handleApply = () => {
    onApply(ranges);
    setApplied(true);
  };

  return (
    <Card className="border-green-300 bg-green-50 dark:bg-green-950/30 dark:border-green-800">
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-1.5">
            <div className="flex items-center gap-2 text-sm">
              <BookOpen className="w-4 h-4 text-green-600 shrink-0" />
              <p className="font-semibold text-green-800 dark:text-green-300">
                الهدف اليوم: {dailyTarget} وجه
                {memorization.juzFrom === memorization.juzTo
                  ? ` — الجزء ${memorization.juzFrom}`
                  : ` — الأجزاء ${memorization.juzFrom} إلى ${memorization.juzTo}`}
                {plan.term && plan.term !== "annual" && (
                  <span className="mr-1 text-xs font-normal text-green-700 dark:text-green-400">
                    ({plan.term_label || termLabel(plan.term)})
                  </span>
                )}
              </p>
            </div>

            <p className="text-xs text-green-700 dark:text-green-400 truncate">
              الحفظ: {memorization.fromLabel}
              <ArrowLeft className="w-3 h-3 inline mx-1" />
              {memorization.toLabel}
            </p>

            {review && (
              <p className="text-xs text-blue-700 dark:text-blue-400 truncate flex items-center gap-1">
                <RefreshCw className="w-3 h-3 shrink-0" />
                المراجعة: {review.fromLabel}
                <ArrowLeft className="w-3 h-3 inline mx-1" />
                {review.toLabel}
                {review.wrapped && <span className="text-[10px]">(بدأت دورة جديدة)</span>}
              </p>
            )}

            {linking && (
              <p className="text-xs text-purple-700 dark:text-purple-400 truncate flex items-center gap-1">
                <Link2 className="w-3 h-3 shrink-0" />
                الربط: {linking.fromLabel}
                <ArrowLeft className="w-3 h-3 inline mx-1" />
                {linking.toLabel}
              </p>
            )}

            <p className="text-[11px] text-green-600 dark:text-green-500">
              {memorization.completed
                ? "أتم الطالب نطاق الخطة"
                : `تم التحديد تلقائياً بناءً على آخر تسميع (${
                    lastRef ? `الجزء ${pageToJuz(currentPage)}` : "بداية المقرر"
                  })`}
            </p>
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
        title="المصحف — خطة الطالب"
        currentPage={memorization.from}
        todayFrom={memorization.from}
        todayTo={memorization.to}
      />
    </Card>
  );
};

export default StudentAnnualPlanCard;
