import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

type DayStatus = "active" | "weekend" | "holiday";

interface CalendarStatus {
  status: DayStatus;
  holidayTitle?: string;
  loading: boolean;
  nextActiveDay: string | null;
}

/**
 * Hook that checks if today is an active halaqa day.
 * - Friday (5) / Saturday (6) → weekend
 * - If date falls in holidays table → holiday
 * - Otherwise → active
 */
export const useAcademicCalendar = (): CalendarStatus => {
  const [status, setStatus] = useState<DayStatus>("active");
  const [holidayTitle, setHolidayTitle] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [nextActiveDay, setNextActiveDay] = useState<string | null>(null);

  const check = useCallback(async () => {
    const today = new Date();
    const day = today.getDay(); // 0=Sun..6=Sat

    // Weekend check: Friday=5, Saturday=6
    if (day === 5 || day === 6) {
      setStatus("weekend");
      setHolidayTitle(undefined);
      computeNextActive(today);
      setLoading(false);
      return;
    }

    // Holiday check
    const todayStr = today.toISOString().split("T")[0];
    const { data } = await supabase
      .from("holidays")
      .select("title")
      .lte("start_date", todayStr)
      .gte("end_date", todayStr)
      .limit(1)
      .maybeSingle();

    if (data) {
      setStatus("holiday");
      setHolidayTitle(data.title);
    } else {
      setStatus("active");
      setHolidayTitle(undefined);
    }

    computeNextActive(today, data ? true : false);
    setLoading(false);
  }, []);

  const computeNextActive = async (from: Date, isHoliday = false) => {
    // Find next active day by checking up to 60 days ahead
    const candidate = new Date(from);
    const todayDay = from.getDay();
    
    // If today is already active, no need
    if (todayDay !== 5 && todayDay !== 6 && !isHoliday) {
      setNextActiveDay(null);
      return;
    }

    for (let i = 1; i <= 60; i++) {
      candidate.setDate(from.getDate() + i);
      const d = candidate.getDay();
      if (d === 5 || d === 6) continue;

      const dateStr = candidate.toISOString().split("T")[0];
      const { data } = await supabase
        .from("holidays")
        .select("id")
        .lte("start_date", dateStr)
        .gte("end_date", dateStr)
        .limit(1)
        .maybeSingle();

      if (!data) {
        setNextActiveDay(
          candidate.toLocaleDateString("ar-SA", { weekday: "long", year: "numeric", month: "long", day: "numeric" })
        );
        return;
      }
    }
    setNextActiveDay(null);
  };

  useEffect(() => { check(); }, [check]);

  return { status, holidayTitle, loading, nextActiveDay };
};
