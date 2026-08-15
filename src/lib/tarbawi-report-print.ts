// Printable (PDF) export for the periodic tarbawi reports (monthly / quarterly).
// Built as an HTML print sheet so Arabic text renders correctly (jsPDF core fonts do not support Arabic).

import { formatDateSmart } from "./hijri";
import { ATTENDANCE_LABELS, gradeLabel } from "./tarbawi";

export interface TarbawiReportRow {
  studentName: string;
  weeks: number;
  present: number;
  absent: number;
  excused: number;
  commitment: number;
  examAvg: number;
  memorization: number;
  listening: number;
  reading: number;
  notes: { week: string; text: string }[];
}

export interface TarbawiReportMeta {
  periodLabel: string;
  halaqaName: string;
  from: string;
  to: string;
  weeks: number;
}

const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

export const buildTarbawiReportHtml = (meta: TarbawiReportMeta, rows: TarbawiReportRow[]): string => {
  const avgCommitment = rows.length
    ? Math.round(rows.reduce((a, r) => a + r.commitment, 0) / rows.length)
    : 0;
  const avgExam = rows.length ? Math.round(rows.reduce((a, r) => a + r.examAvg, 0) / rows.length) : 0;

  const table = `
    <table>
      <thead>
        <tr>
          <th>#</th><th>الطالب</th><th>الأسابيع</th><th>حاضر</th>
          <th>${esc(ATTENDANCE_LABELS.absent)}</th><th>${esc(ATTENDANCE_LABELS.excused)}</th>
          <th>الحفظ (أسابيع)</th><th>السماع (دقيقة)</th><th>القراءة (صفحة)</th>
          <th>متوسط الاختبارات</th><th>الالتزام</th><th>التقدير</th>
        </tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (r, i) => `<tr>
          <td>${i + 1}</td><td>${esc(r.studentName)}</td><td>${r.weeks}</td><td>${r.present}</td>
          <td>${r.absent}</td><td>${r.excused}</td>
          <td>${r.memorization}</td><td>${r.listening}</td><td>${r.reading}</td>
          <td>${r.examAvg}%</td><td>${r.commitment}%</td><td>${esc(gradeLabel(r.commitment))}</td>
        </tr>`,
          )
          .join("")}
        ${rows.length ? "" : `<tr><td colspan="12">لا يوجد طلاب في الحلقة المختارة.</td></tr>`}
      </tbody>
    </table>`;

  const notes = rows
    .filter((r) => r.notes.length)
    .map(
      (r) => `<section class="notes">
        <h3>${esc(r.studentName)}</h3>
        <ul>${r.notes.map((n) => `<li>${esc(formatDateSmart(n.week))}: ${esc(n.text)}</li>`).join("")}</ul>
      </section>`,
    )
    .join("");

  return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8" />
<title>${esc(`تقرير تربوي ${meta.periodLabel} — ${meta.halaqaName}`)}</title>
<style>
  body{font-family:"IBM Plex Sans Arabic",Tahoma,Arial,sans-serif;direction:rtl;padding:24px;color:#0f172a}
  header{border-bottom:3px solid #14532d;padding-bottom:10px;margin-bottom:14px}
  h1{margin:0;font-size:19px;color:#14532d}
  .sub{font-size:12px;color:#475569;margin-top:4px}
  .summary{display:flex;flex-wrap:wrap;gap:6px 16px;font-size:12px;margin-bottom:12px;color:#334155}
  table{width:100%;border-collapse:collapse;font-size:11px}
  th,td{border:1px solid #cbd5e1;padding:4px 6px;text-align:center}
  th{background:#14532d;color:#fff}
  tbody tr:nth-child(even){background:#f8fafc}
  section.notes{margin-top:14px;page-break-inside:avoid}
  section.notes h3{font-size:13px;margin:0 0 4px;background:#f1f5f9;padding:5px 8px;border-right:4px solid #14532d}
  section.notes ul{margin:0;padding-inline-start:18px;font-size:11px;color:#334155}
  @media print{body{padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<header>
  <h1>${esc(`تقرير تربوي ${meta.periodLabel} — ${meta.halaqaName}`)}</h1>
  <div class="sub">الفترة: ${esc(formatDateSmart(meta.from))} إلى ${esc(formatDateSmart(meta.to))} (${meta.weeks} أسابيع)</div>
</header>
<div class="summary">
  <span><b>عدد الطلاب:</b> ${rows.length}</span>
  <span><b>متوسط الالتزام:</b> ${avgCommitment}% — ${esc(gradeLabel(avgCommitment))}</span>
  <span><b>متوسط الاختبارات:</b> ${avgExam}%</span>
</div>
${table}
${notes ? `<h2 style="font-size:14px;color:#14532d;margin:18px 0 6px">ملاحظات المعلم</h2>${notes}` : ""}
<script>window.onload=()=>{window.print()}</script>
</body></html>`;
};

export const openTarbawiReportPrint = (meta: TarbawiReportMeta, rows: TarbawiReportRow[]): boolean => {
  const w = window.open("", "_blank");
  if (!w) return false;
  w.document.write(buildTarbawiReportHtml(meta, rows));
  w.document.close();
  return true;
};
