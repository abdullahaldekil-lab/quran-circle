import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx-js-style';
import { createFlow } from './himmah';
const PAGE = { width: 297, height: 210, margin: 10 };
/** Blocks with a transparent background inherit the nearest painted ancestor so text stays readable in both themes. */
function backgroundOf(element: HTMLElement) {
  for (let node: HTMLElement | null = element; node; node = node.parentElement) { const color = getComputedStyle(node).backgroundColor; if (color && color !== 'transparent' && !/rgba\(\s*0\s*,\s*0\s*,\s*0\s*,\s*0\s*\)/.test(color)) return color; }
  return '#ffffff';
}
/**
 * Renders each element on its own canvas (never one canvas for the whole report, which exceeds browser canvas limits)
 * and flows them down A4 landscape pages. Certificates take a full page each. Returns the number of pages written.
 */
export async function himmahPdf(elements: HTMLElement[], name: string, onProgress?: (done: number, total: number) => void) {
  await document.fonts.ready;
  const pdf = new jsPDF({ orientation: 'landscape', format: 'a4', unit: 'mm', compress: true });
  const usable = { width: PAGE.width - 2 * PAGE.margin, height: PAGE.height - 2 * PAGE.margin };
  const flow = createFlow(usable.height); const gap = 4; let pages = 1; let index = 0;
  const goTo = (page: number) => { while (pages <= page) { pdf.addPage(); pages++; } pdf.setPage(page + 1); };
  for (const element of elements) {
    onProgress?.(index++, elements.length);
    const canvas = await html2canvas(element, { scale: 1.5, useCORS: true, backgroundColor: backgroundOf(element) });
    if (!canvas.width || !canvas.height) continue;
    if (element.classList.contains('himmah-certificate')) {
      // One certificate per page, scaled to fit so name, signatures and stamp are never cut.
      const [piece] = flow.place(usable.height); goTo(piece.page);
      const ratio = Math.min(usable.width / canvas.width, usable.height / canvas.height); const w = canvas.width * ratio, h = canvas.height * ratio;
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.82), 'JPEG', (PAGE.width - w) / 2, (PAGE.height - h) / 2, w, h, undefined, 'FAST');
      continue;
    }
    const mmPerPx = usable.width / canvas.width;
    for (const piece of flow.place(canvas.height * mmPerPx + gap)) {
      const top = Math.round(piece.offset / mmPerPx); const heightPx = Math.min(canvas.height - top, Math.round(piece.height / mmPerPx));
      if (heightPx <= 0) continue;
      goTo(piece.page);
      const slice = document.createElement('canvas'); slice.width = canvas.width; slice.height = heightPx;
      slice.getContext('2d')?.drawImage(canvas, 0, top, slice.width, heightPx, 0, 0, slice.width, heightPx);
      pdf.addImage(slice.toDataURL('image/jpeg', 0.85), 'JPEG', PAGE.margin, PAGE.margin + piece.y, usable.width, heightPx * mmPerPx, undefined, 'FAST');
    }
  }
  onProgress?.(elements.length, elements.length);
  pdf.save(`${name}.pdf`);
  return flow.pages;
}
export function himmahExcel(rows: Record<string, string | number>[], name: string) {
  const book = XLSX.utils.book_new(); const sheet = XLSX.utils.json_to_sheet(rows);
  sheet['!cols'] = Object.keys(rows[0] || {}).map(() => ({ wch: 24 }));
  book.Workbook = { Views: [{ RTL: true }] };
  XLSX.utils.book_append_sheet(book, sheet, 'يوم الهمة'); XLSX.writeFile(book, `${name}.xlsx`);
}