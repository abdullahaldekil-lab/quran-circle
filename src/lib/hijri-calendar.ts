// Hijri month-grid builder for the task planner calendar.
// Kept separate from `hijri.ts` (formatting helpers) so the grid logic is unit-testable.

import moment from "moment-hijri";
import { HIJRI_MONTHS } from "./hijri";

export interface HijriDay {
  /** Gregorian ISO date (YYYY-MM-DD) — the key used by all task/event queries. */
  iso: string;
  hijriDay: number;
  /** 0 = Sunday … 6 = Saturday */
  weekday: number;
  gregorianDay: number;
  gregorianMonth: number;
}

export interface HijriMonthGrid {
  year: number;
  month: number;
  label: string;
  days: HijriDay[];
  /** Empty cells before the 1st of the month (grid starts on Sunday). */
  leadingBlanks: number;
  startIso: string;
  endIso: string;
}

export const HIJRI_MONTH_NAMES = HIJRI_MONTHS;

/** Weekend in the academic calendar: Friday + Saturday. */
export const isWeekendDay = (weekday: number) => weekday === 5 || weekday === 6;

export const buildHijriMonth = (year: number, month: number): HijriMonthGrid => {
  const first = moment(`${year}/${month}/1`, "iYYYY/iM/iD");
  const total = first.iDaysInMonth();
  const days: HijriDay[] = [];
  for (let d = 0; d < total; d++) {
    const m = first.clone().add(d, "days");
    const js = m.toDate();
    days.push({
      iso: m.format("YYYY-MM-DD"),
      hijriDay: d + 1,
      weekday: js.getDay(),
      gregorianDay: js.getDate(),
      gregorianMonth: js.getMonth() + 1,
    });
  }
  return {
    year,
    month,
    label: `${HIJRI_MONTH_NAMES[month - 1]} ${year} هـ`,
    days,
    leadingBlanks: days.length ? days[0].weekday : 0,
    startIso: days[0]?.iso ?? "",
    endIso: days[days.length - 1]?.iso ?? "",
  };
};

/** Current Hijri year/month, used as the calendar's initial position. */
export const currentHijriPosition = (): { year: number; month: number } => {
  const m = moment();
  return { year: m.iYear(), month: m.iMonth() + 1 };
};

/** Inclusive check used to paint holiday ranges on the grid. */
export const isWithinRange = (iso: string, from: string, to: string) => iso >= from && iso <= to;

/** A task is late when it has a past due date and was neither completed nor cancelled. */
export const isTaskLate = (
  task: { due_date?: string | null; status?: string | null },
  todayIso: string = new Date().toISOString().slice(0, 10),
): boolean =>
  !!task.due_date &&
  task.due_date < todayIso &&
  task.status !== "completed" &&
  task.status !== "cancelled";
