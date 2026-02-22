import jsPDF from "jspdf";
import "jspdf-autotable";
import * as XLSX from "xlsx";

// Extend jsPDF type for autotable
declare module "jspdf" {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
    lastAutoTable: { finalY: number };
  }
}

const FONT_SIZE = { title: 16, subtitle: 12, body: 10, small: 8 };
const COLORS = {
  primary: [30, 58, 95] as [number, number, number],
  success: [22, 163, 74] as [number, number, number],
  danger: [220, 38, 38] as [number, number, number],
  gray: [107, 114, 128] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
};

function createPdf(landscape = false): jsPDF {
  const doc = new jsPDF({ orientation: landscape ? "landscape" : "portrait", unit: "mm", format: "a4" });
  return doc;
}

function addHeader(doc: jsPDF, title: string, subtitle?: string) {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFontSize(FONT_SIZE.title);
  doc.setTextColor(...COLORS.primary);
  doc.text(title, pageWidth / 2, 20, { align: "center" });
  doc.setFontSize(FONT_SIZE.small);
  doc.setTextColor(...COLORS.gray);
  doc.text("مجمع حويلان لتحفيظ القرآن الكريم", pageWidth / 2, 28, { align: "center" });
  if (subtitle) {
    doc.setFontSize(FONT_SIZE.subtitle);
    doc.setTextColor(...COLORS.primary);
    doc.text(subtitle, pageWidth / 2, 36, { align: "center" });
  }
  // Separator line
  const y = subtitle ? 40 : 32;
  doc.setDrawColor(...COLORS.primary);
  doc.setLineWidth(0.5);
  doc.line(20, y, pageWidth - 20, y);
  return y + 5;
}

// ==================== SESSION EXPORT ====================

interface SessionAttempt {
  students?: { full_name?: string; halaqat?: { name?: string } };
  total_hizb_count: number;
  mistakes_count: number;
  lahn_count: number;
  warnings_count: number;
  grade: number;
  status: string;
}

interface SessionExportData {
  sessionDate: string;
  sessionTitle: string;
  halaqaName: string;
  attempts: SessionAttempt[];
}

export function exportSessionToExcel(data: SessionExportData) {
  const rows = data.attempts
    .filter((a) => a.status !== "absent" && a.status !== "pending")
    .sort((a, b) => Number(b.grade) - Number(a.grade))
    .map((a, i) => ({
      "#": i + 1,
      الطالب: a.students?.full_name || "—",
      الحلقة: a.students?.halaqat?.name || "—",
      الأحزاب: Number(a.total_hizb_count),
      الأخطاء: a.mistakes_count,
      اللحون: a.lahn_count,
      التنبيهات: a.warnings_count,
      الدرجة: Number(a.grade),
      الحالة: a.status === "pass" ? "ناجح" : "راسب",
    }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "نتائج الجلسة");

  // Add header info
  XLSX.utils.sheet_add_aoa(ws, [
    [`تقرير جلسة السرد — ${data.sessionDate} — ${data.halaqaName || data.sessionTitle}`],
  ], { origin: "A1" });

  ws["!cols"] = [
    { wch: 5 }, { wch: 25 }, { wch: 20 }, { wch: 10 },
    { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
  ];

  XLSX.writeFile(wb, `تقرير_جلسة_السرد_${data.sessionDate}.xlsx`);
}

export function exportSessionToPdf(data: SessionExportData) {
  const doc = createPdf();
  const subtitle = `جلسة ${data.sessionDate} — ${data.halaqaName || data.sessionTitle}`;
  let startY = addHeader(doc, "تقرير جلسة السرد القرآني", subtitle);

  const presented = data.attempts.filter((a) => a.status !== "absent" && a.status !== "pending");
  const passed = presented.filter((a) => a.status === "pass");
  const totalHizb = presented.reduce((s, a) => s + Number(a.total_hizb_count), 0);
  const avgGrade = presented.length > 0
    ? (presented.reduce((s, a) => s + Number(a.grade), 0) / presented.length).toFixed(1)
    : "—";

  // Summary
  doc.setFontSize(FONT_SIZE.body);
  doc.setTextColor(0, 0, 0);
  const summaryItems = [
    `الحضور: ${presented.length}`,
    `المجتازون: ${passed.length}`,
    `مجموع الأحزاب: ${totalHizb}`,
    `متوسط الدرجة: ${avgGrade}`,
    `نسبة الاجتياز: ${presented.length > 0 ? Math.round((passed.length / presented.length) * 100) : 0}%`,
  ];
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.text(summaryItems.join("    |    "), pageWidth / 2, startY + 5, { align: "center" });
  startY += 12;

  // Table
  const ranked = [...presented].sort((a, b) => Number(b.grade) - Number(a.grade));
  doc.autoTable({
    startY,
    head: [["#", "الطالب", "الحلقة", "الأحزاب", "الأخطاء", "اللحون", "التنبيهات", "الدرجة", "الحالة"]],
    body: ranked.map((a, i) => [
      i + 1,
      a.students?.full_name || "—",
      a.students?.halaqat?.name || "—",
      Number(a.total_hizb_count),
      a.mistakes_count,
      a.lahn_count,
      a.warnings_count,
      Number(a.grade),
      a.status === "pass" ? "ناجح" : "راسب",
    ]),
    styles: { font: "helvetica", fontSize: 9, halign: "center", cellPadding: 2 },
    headStyles: { fillColor: COLORS.primary, textColor: COLORS.white, halign: "center" },
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
    didParseCell: (data: any) => {
      if (data.section === "body" && data.column.index === 8) {
        data.cell.styles.textColor = data.cell.raw === "ناجح" ? COLORS.success : COLORS.danger;
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  doc.save(`تقرير_جلسة_السرد_${data.sessionDate}.pdf`);
}

// ==================== OVERALL EXPORT ====================

interface HalaqaStat {
  name: string;
  totalStudents: number;
  passed: number;
  totalHizb: number;
  avgGrade: string;
  passRate: number;
}

export function exportOverallToExcel(halaqatStats: HalaqaStat[]) {
  const rows = halaqatStats.map((h, i) => ({
    "#": i + 1,
    الحلقة: h.name,
    "عدد الطلاب": h.totalStudents,
    "مج. الأحزاب": h.totalHizb,
    المجتازون: h.passed,
    "متوسط الدرجة": h.avgGrade,
    "نسبة الاجتياز": `${h.passRate}%`,
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "تقرير المجمع");
  ws["!cols"] = [
    { wch: 5 }, { wch: 25 }, { wch: 12 }, { wch: 12 },
    { wch: 12 }, { wch: 14 }, { wch: 14 },
  ];
  XLSX.writeFile(wb, "تقرير_المجمع_السرد.xlsx");
}

export function exportOverallToPdf(halaqatStats: HalaqaStat[]) {
  const doc = createPdf();
  let startY = addHeader(doc, "تقرير المجمع — يوم السرد القرآني");

  doc.autoTable({
    startY,
    head: [["#", "الحلقة", "عدد الطلاب", "مج. الأحزاب", "المجتازون", "متوسط الدرجة", "نسبة الاجتياز"]],
    body: halaqatStats.map((h, i) => [
      i + 1, h.name, h.totalStudents, h.totalHizb, h.passed, h.avgGrade, `${h.passRate}%`,
    ]),
    styles: { font: "helvetica", fontSize: 10, halign: "center", cellPadding: 3 },
    headStyles: { fillColor: COLORS.primary, textColor: COLORS.white },
    columnStyles: { 1: { halign: "right" } },
    didParseCell: (data: any) => {
      if (data.section === "body" && data.column.index === 6) {
        const rate = parseInt(data.cell.raw);
        data.cell.styles.textColor = rate >= 70 ? COLORS.success : COLORS.danger;
        data.cell.styles.fontStyle = "bold";
      }
    },
  });

  doc.save("تقرير_المجمع_السرد.pdf");
}

// ==================== BULK CERTIFICATES ====================

interface CertData {
  studentName: string;
  halaqaName: string;
  totalHizb: number;
  grade: number;
  maxGrade: number;
  status: "pass" | "fail";
  halaqaRank: number;
  sessionDate: string;
}

export function exportBulkCertificatesPdf(certs: CertData[], sessionDateStr: string) {
  const doc = createPdf();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  certs.forEach((cert, idx) => {
    if (idx > 0) doc.addPage();

    // Border
    doc.setDrawColor(...COLORS.primary);
    doc.setLineWidth(1);
    doc.rect(15, 15, pageWidth - 30, pageHeight - 30);
    doc.setLineWidth(0.3);
    doc.rect(18, 18, pageWidth - 36, pageHeight - 36);

    // Header
    doc.setFontSize(14);
    doc.setTextColor(...COLORS.primary);
    doc.text("مجمع حويلان لتحفيظ القرآن الكريم", pageWidth / 2, 35, { align: "center" });

    doc.setFontSize(18);
    doc.setTextColor(37, 99, 235);
    doc.text("شهادة يوم السرد القرآني", pageWidth / 2, 48, { align: "center" });

    // Decorative line
    doc.setDrawColor(37, 99, 235);
    doc.setLineWidth(0.8);
    doc.line(pageWidth / 2 - 30, 52, pageWidth / 2 + 30, 52);

    // Body text
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text("يشهد مجمع حويلان لتحفيظ القرآن الكريم بأن الطالب", pageWidth / 2, 70, { align: "center" });

    doc.setFontSize(20);
    doc.setTextColor(...COLORS.primary);
    doc.text(cert.studentName, pageWidth / 2, 85, { align: "center" });

    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(`من حلقة: ${cert.halaqaName}`, pageWidth / 2, 98, { align: "center" });

    const dateStr = new Date(cert.sessionDate).toLocaleDateString("ar-SA");
    doc.text(`قد شارك في يوم السرد القرآني بتاريخ ${dateStr}`, pageWidth / 2, 110, { align: "center" });
    doc.text(`وقام بسرد ${cert.totalHizb} حزب/أحزاب`, pageWidth / 2, 122, { align: "center" });

    // Results boxes
    const boxY = 140;
    const boxW = 45;
    const boxH = 35;
    const gap = 10;
    const totalW = boxW * 3 + gap * 2;
    const startX = (pageWidth - totalW) / 2;

    // Grade box
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(startX, boxY, boxW, boxH, 3, 3, "F");
    doc.setDrawColor(229, 231, 235);
    doc.roundedRect(startX, boxY, boxW, boxH, 3, 3, "S");
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.gray);
    doc.text("الدرجة", startX + boxW / 2, boxY + 10, { align: "center" });
    doc.setFontSize(16);
    doc.setTextColor(...COLORS.primary);
    doc.text(`${cert.grade} / ${cert.maxGrade}`, startX + boxW / 2, boxY + 25, { align: "center" });

    // Status box
    const statusX = startX + boxW + gap;
    const statusColor = cert.status === "pass" ? [240, 253, 244] : [254, 242, 242];
    doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
    doc.roundedRect(statusX, boxY, boxW, boxH, 3, 3, "F");
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.gray);
    doc.text("الحالة", statusX + boxW / 2, boxY + 10, { align: "center" });
    doc.setFontSize(16);
    doc.setTextColor(...(cert.status === "pass" ? COLORS.success : COLORS.danger));
    doc.text(cert.status === "pass" ? "ناجح" : "راسب", statusX + boxW / 2, boxY + 25, { align: "center" });

    // Rank box
    const rankX = statusX + boxW + gap;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(rankX, boxY, boxW, boxH, 3, 3, "F");
    doc.setDrawColor(229, 231, 235);
    doc.roundedRect(rankX, boxY, boxW, boxH, 3, 3, "S");
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.gray);
    doc.text("الترتيب في الحلقة", rankX + boxW / 2, boxY + 10, { align: "center" });
    doc.setFontSize(16);
    doc.setTextColor(...COLORS.primary);
    doc.text(cert.halaqaRank > 0 ? `${cert.halaqaRank}` : "—", rankX + boxW / 2, boxY + 25, { align: "center" });

    // Signatures
    const sigY = pageHeight - 50;
    doc.setFontSize(10);
    doc.setTextColor(...COLORS.gray);
    doc.text("توقيع المعلم: ___________________", 40, sigY);
    doc.text("توقيع المشرف: ___________________", pageWidth - 40, sigY, { align: "right" });
  });

  doc.save(`شهادات_السرد_${sessionDateStr}.pdf`);
}
