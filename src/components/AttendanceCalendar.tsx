import { useState, useEffect, useMemo } from "react";
import { formatDateSmart, toHijri } from "@/lib/hijri";
import { supabase } from "@/integrations/supabase/client";
import { ChevronRight, ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DaySummary {
  date: string;
  hasAbsent: boolean;
  hasLate: boolean;
  allPresent: boolean;
  count: number;
}

interface AttendanceCalendarProps {
  halaqaId: string;
  selectedDate: string;
  onSelectDate: (date: string) => void;
}

const AttendanceCalendar = ({ halaqaId, selectedDate, onSelectDate }: AttendanceCalendarProps) => {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date(selectedDate);
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [summaries, setSummaries] = useState<Record<string, DaySummary>>({});
  const [holidays, setHolidays] = useState<{ start_date: string; end_date: string }[]>([]);

  // Fetch month attendance summary
  useEffect(() => {
    if (!halaqaId) return;
    const startDate = `${currentMonth.year}-${String(currentMonth.month + 1).padStart(2, "0")}-01`;
    const lastDay = new Date(currentMonth.year, currentMonth.month + 1, 0).getDate();
    const endDate = `${currentMonth.year}-${String(currentMonth.month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

    Promise.all([
      supabase
        .from("attendance")
        .select("attendance_date, status")
        .eq("halaqa_id", halaqaId)
        .gte("attendance_date", startDate)
        .lte("attendance_date", endDate),
      supabase
        .from("holidays")
        .select("start_date, end_date")
        .lte("start_date", endDate)
        .gte("end_date", startDate),
    ]).then(([attRes, holRes]) => {
      // Build summaries
      const map: Record<string, { absent: number; late: number; present: number; total: number }> = {};
      (attRes.data || []).forEach((r: any) => {
        if (!map[r.attendance_date]) map[r.attendance_date] = { absent: 0, late: 0, present: 0, total: 0 };
        map[r.attendance_date].total++;
        if (r.status === "absent") map[r.attendance_date].absent++;
        else if (r.status === "late") map[r.attendance_date].late++;
        else map[r.attendance_date].present++;
      });

      const result: Record<string, DaySummary> = {};
      Object.entries(map).forEach(([date, s]) => {
        result[date] = {
          date,
          hasAbsent: s.absent > 0,
          hasLate: s.late > 0,
          allPresent: s.absent === 0 && s.late === 0 && s.total > 0,
          count: s.total,
        };
      });
      setSummaries(result);
      setHolidays((holRes.data as any[]) || []);
    });
  }, [halaqaId, currentMonth]);

  const isHoliday = (dateStr: string) => {
    return holidays.some((h) => dateStr >= h.start_date && dateStr <= h.end_date);
  };

  const isWeekend = (date: Date) => {
    const day = date.getDay();
    return day === 5 || day === 6; // Friday, Saturday
  };

  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentMonth.year, currentMonth.month, 1);
    const lastDay = new Date(currentMonth.year, currentMonth.month + 1, 0);
    // Saturday = 6 is first column in Saudi calendar. JS getDay: 0=Sun..6=Sat
    // We want Sat=0, Sun=1, Mon=2... Fri=6
    const startOffset = (firstDay.getDay() + 1) % 7;
    const days: (Date | null)[] = [];
    for (let i = 0; i < startOffset; i++) days.push(null);
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push(new Date(currentMonth.year, currentMonth.month, d));
    }
    return days;
  }, [currentMonth]);

  const getDayColor = (date: Date) => {
    const dateStr = date.toISOString().split("T")[0];
    const today = new Date().toISOString().split("T")[0];
    if (dateStr > today) return "text-muted-foreground/40";
    if (isWeekend(date)) return "bg-blue-100 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300";
    if (isHoliday(dateStr)) return "bg-muted text-muted-foreground";
    const summary = summaries[dateStr];
    if (!summary) return "";
    if (summary.hasAbsent) return "bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-300";
    if (summary.hasLate) return "bg-yellow-100 dark:bg-yellow-950/30 text-yellow-700 dark:text-yellow-300";
    if (summary.allPresent) return "bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-300";
    return "";
  };

  const prevMonth = () => {
    setCurrentMonth((p) => {
      if (p.month === 0) return { year: p.year - 1, month: 11 };
      return { year: p.year, month: p.month - 1 };
    });
  };

  const nextMonth = () => {
    setCurrentMonth((p) => {
      if (p.month === 11) return { year: p.year + 1, month: 0 };
      return { year: p.year, month: p.month + 1 };
    });
  };

  const dayHeaders = ["س", "ح", "ن", "ث", "ر", "خ", "ج"]; // Sat–Fri

  const monthLabel = formatDateSmart(new Date(currentMonth.year, currentMonth.month));

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="icon" onClick={nextMonth}><ChevronRight className="w-4 h-4" /></Button>
        <span className="font-bold text-sm">{monthLabel}</span>
        <Button variant="ghost" size="icon" onClick={prevMonth}><ChevronLeft className="w-4 h-4" /></Button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {dayHeaders.map((d) => (
          <div key={d} className="text-xs font-medium text-muted-foreground py-1">{d}</div>
        ))}
      </div>

      {/* Days */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((date, i) => {
          if (!date) return <div key={`empty-${i}`} />;
          const dateStr = date.toISOString().split("T")[0];
          const isSelected = dateStr === selectedDate;
          const today = new Date().toISOString().split("T")[0];
          const isFuture = dateStr > today;

          return (
            <button
              key={dateStr}
              disabled={isFuture}
              onClick={() => onSelectDate(dateStr)}
              className={`aspect-square flex items-center justify-center rounded-lg text-xs font-medium transition-all
                ${getDayColor(date)}
                ${isSelected ? "ring-2 ring-primary ring-offset-1" : ""}
                ${isFuture ? "cursor-default" : "hover:ring-1 hover:ring-primary/50"}
              `}
            >
              {toHijri(date).day}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs pt-2">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-200 dark:bg-green-900" /> حضور كامل</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-200 dark:bg-yellow-900" /> تأخر</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-200 dark:bg-red-900" /> غياب</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-200 dark:bg-blue-900" /> عطلة أسبوعية</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-muted" /> إجازة</span>
      </div>
    </div>
  );
};

export default AttendanceCalendar;
