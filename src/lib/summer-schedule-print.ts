// Daily-schedule row builder + printable (PDF) export for the summer program.
// Extracted so the schedule table and the printed sheet always match.

import { isWorkingDay, type HolidayRange } from "./summer-scoring";
import { formatDateHijriOnly, getWeekdayArabic } from "./hijri";
import { juzRangeToPageBounds } from "./mushaf";

export interface ScheduleRow {
  idx: number;
  date: string;
  weekday: string;
  hijri: string;
  target: number;
  targetCum: number;
  actual: number;
  actualCum: number;
  /** Mushaf-order page range for the day (Madinah mushaf), when the juz range is known. */
  pageFrom: number | null;
  pageTo: number | null;
  status: "done" | "partial" | "late" | "future";
}


export interface SchedulePlan {
  plan_start_date: string | null;
  plan_end_date: string | null;
  pages_target: number | null;
  daily_pages: number | null;
  plan_type?: string | null;
  plan_track?: string | null;
  assigned_reciter?: string | null;
  juz_from?: number | null;
  juz_to?: number | null;
}

export const STATUS_LABELS: Record<ScheduleRow["status"], string> = {
  done: "منجز",
  partial: "جزئي",
  late: "متأخر",
  future: "قادم",
};

export const buildScheduleRows = (
  plan: SchedulePlan,
  actualByDate: Record<string, number>,
  holidays: HolidayRange[] = [],
  todayISO: string = new Date().toISOString().slice(0, 10),
): ScheduleRow[] => {
  if (!plan.plan_start_date || !plan.plan_end_date) return [];
  const target = plan.pages_target || 0;
  if (target <= 0) return [];
  const start = new Date(plan.plan_start_date);
  const end = new Date(plan.plan_end_date);
  const totalDays = Math.max(1, Math.floor((end.getTime() - start.getTime()) / 86400000) + 1);
  const daily = Math.max(1, Math.ceil(plan.daily_pages || 0));
  const bounds = juzRangeToPageBounds(plan.juz_from, plan.juz_to);

  const rows: ScheduleRow[] = [];
  let cum = 0;
  let actualCum = 0;
  let idx = 0;
  for (let i = 0; i < totalDays && cum < target; i++) {
    const d = new Date(start.getTime() + i * 86400000);
    if (!isWorkingDay(d, holidays)) continue;
    idx += 1;
    const key = d.toISOString().slice(0, 10);
    const dayTarget = Math.min(daily, target - cum);
    // Mushaf-order pages: continue exactly where the previous day ended.
    const pageFrom = bounds ? Math.min(bounds.end, bounds.start + cum) : null;
    const pageTo = bounds && pageFrom ? Math.min(bounds.end, pageFrom + dayTarget - 1) : null;
    cum += dayTarget;
    const actual = actualByDate[key] || 0;
    actualCum = Math.round((actualCum + actual) * 100) / 100;
    const status: ScheduleRow["status"] =
      key > todayISO ? "future" : actual >= dayTarget ? "done" : actual > 0 ? "partial" : "late";
    rows.push({
      idx,
      date: key,
      weekday: getWeekdayArabic(d),
      hijri: formatDateHijriOnly(d),
      target: dayTarget,
      targetCum: cum,
      actual,
      actualCum,
      pageFrom,
      pageTo,
      status,
    });
  }

  return rows;
};

export interface PrintStudentSection {
  studentName: string;
  plan: SchedulePlan;
  rows: ScheduleRow[];
}

const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

const planTypeLabel = (t?: string | null) => (t === "hifz" ? "حفظ" : t === "taahud" ? "إتقان / تعاهد" : "—");

const statusColor: Record<ScheduleRow["status"], string> = {
  done: "#15803d",
  partial: "#b45309",
  late: "#b91c1c",
  future: "#64748b",
};

export const buildSchedulePrintHtml = (
  title: string,
  subtitle: string,
  sections: PrintStudentSection[],
): string => {
  const today = formatDateHijriOnly(new Date().toISOString().slice(0, 10));
  const body = sections
    .map((s) => {
      const workingDays = s.rows.length;
      const totalActual = s.rows.length ? s.rows[s.rows.length - 1].actualCum : 0;
      const target = s.plan.pages_target || 0;
      const pct = target > 0 ? Math.min(100, Math.round((totalActual / target) * 100)) : 0;
      return `
      <section class="student">
        <h2>${esc(s.studentName)}</h2>
        <div class="meta">
          <span><b>نوع الخطة:</b> ${esc(planTypeLabel(s.plan.plan_type))}</span>
          ${s.plan.plan_track ? `<span><b>المسار:</b> ${esc(s.plan.plan_track)}</span>` : ""}
          ${s.plan.assigned_reciter ? `<span><b>المقرئ:</b> ${esc(s.plan.assigned_reciter)}</span>` : ""}
          ${s.plan.juz_from && s.plan.juz_to ? `<span><b>الأجزاء:</b> ${s.plan.juz_from}–${s.plan.juz_to}</span>` : ""}
          <span><b>الإجمالي:</b> ${target} وجه</span>
          <span><b>الحد اليومي:</b> ${Math.max(1, Math.ceil(s.plan.daily_pages || 0))} وجه</span>
          <span><b>أيام العمل:</b> ${workingDays}</span>
          <span><b>من:</b> ${esc(s.plan.plan_start_date ? formatDateHijriOnly(s.plan.plan_start_date) : "—")}</span>
          <span><b>إلى:</b> ${esc(s.plan.plan_end_date ? formatDateHijriOnly(s.plan.plan_end_date) : "—")}</span>
          <span><b>المنجز:</b> ${totalActual} وجه (${pct}%)</span>
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th><th>اليوم</th><th>التاريخ الهجري</th><th>المطلوب</th>
              <th>تراكمي مطلوب</th><th>المسمَّع</th><th>تراكمي فعلي</th><th>الحالة</th>
            </tr>
          </thead>
          <tbody>
            ${s.rows
              .map(
                (r) => `<tr>
              <td>${r.idx}</td><td>${esc(r.weekday)}</td><td>${esc(r.hijri)}</td>
              <td>${r.target}</td><td>${r.targetCum}</td><td>${r.actual || "—"}</td>
              <td>${r.actualCum}</td>
              <td style="color:${statusColor[r.status]};font-weight:600">${STATUS_LABELS[r.status]}</td>
            </tr>`,
              )
              .join("")}
            ${s.rows.length ? "" : `<tr><td colspan="8">لا توجد خطة بتواريخ.</td></tr>`}
          </tbody>
        </table>
      </section>`;
    })
    .join("");

  return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8" />
<title>${esc(title)}</title>
<style>
  body{font-family:"IBM Plex Sans Arabic",Tahoma,Arial,sans-serif;direction:rtl;padding:24px;color:#0f172a}
  header{border-bottom:3px solid #14532d;padding-bottom:10px;margin-bottom:16px}
  h1{margin:0;font-size:20px;color:#14532d}
  .sub{font-size:12px;color:#475569;margin-top:4px}
  section.student{margin-bottom:26px;page-break-inside:avoid}
  h2{font-size:15px;margin:0 0 6px;background:#f1f5f9;padding:6px 8px;border-right:4px solid #14532d}
  .meta{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:11px;margin-bottom:8px;color:#334155}
  table{width:100%;border-collapse:collapse;font-size:11px}
  th,td{border:1px solid #cbd5e1;padding:4px 6px;text-align:right}
  th{background:#14532d;color:#fff}
  tbody tr:nth-child(even){background:#f8fafc}
  @media print{body{padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<header><h1>${esc(title)}</h1><div class="sub">${esc(subtitle)} · تاريخ الطباعة: ${esc(today)}</div></header>
${body || '<p style="text-align:center">لا توجد بيانات للطباعة.</p>'}
<script>window.onload=()=>{window.print()}</script>
</body></html>`;
};

export const openSchedulePrint = (
  title: string,
  subtitle: string,
  sections: PrintStudentSection[],
): boolean => {
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(buildSchedulePrintHtml(title, subtitle, sections));
  w.document.close();
  return true;
};
