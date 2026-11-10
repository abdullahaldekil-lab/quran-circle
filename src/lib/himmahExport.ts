import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx-js-style';
export async function himmahPdf(elements: HTMLElement[], name: string) {
  await document.fonts.ready;
  const pdf = new jsPDF({ orientation: 'landscape', format: 'a4', unit: 'mm' });
  let count = 0;
  for (const element of elements) {
    const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: getComputedStyle(element).backgroundColor });
    const pageHeightPx = Math.floor(canvas.width * 190 / 277);
    for (let y = 0; y < canvas.height; y += pageHeightPx) {
      if (count++) pdf.addPage();
      const slice = document.createElement('canvas'); slice.width = canvas.width; slice.height = Math.min(pageHeightPx, canvas.height - y);
      slice.getContext('2d')?.drawImage(canvas, 0, y, slice.width, slice.height, 0, 0, slice.width, slice.height);
      pdf.addImage(slice.toDataURL('image/png'), 'PNG', 10, 10, 277, slice.height * 277 / slice.width);
    }
  }
  pdf.save(`${name}.pdf`);
}
export function himmahExcel(rows: Record<string, string | number>[], name: string) {
  const book = XLSX.utils.book_new(); const sheet = XLSX.utils.json_to_sheet(rows);
  sheet['!cols'] = Object.keys(rows[0] || {}).map(() => ({ wch: 24 }));
  book.Workbook = { Views: [{ RTL: true }] };
  XLSX.utils.book_append_sheet(book, sheet, 'يوم الهمة'); XLSX.writeFile(book, `${name}.xlsx`);
}