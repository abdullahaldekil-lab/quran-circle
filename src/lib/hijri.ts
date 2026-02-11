import { toHijri, toGregorian } from "islamic-date";

/**
 * Convert a Gregorian date to Hijri string (YYYY/MM/DD)
 */
export function gregorianToHijri(date: Date): string {
  const hijri = toHijri(date);
  const y = hijri.year;
  const m = String(hijri.month).padStart(2, "0");
  const d = String(hijri.day).padStart(2, "0");
  return `${y}/${m}/${d}`;
}

/**
 * Convert a Hijri string (YYYY/MM/DD) to Gregorian Date
 */
export function hijriToGregorian(hijriStr: string): Date | null {
  try {
    const parts = hijriStr.split("/").map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return null;
    const [year, month, day] = parts;
    return toGregorian(year, month, day);
  } catch {
    return null;
  }
}

/**
 * Format Hijri date for display in Arabic
 */
const HIJRI_MONTHS = [
  "محرّم", "صفر", "ربيع الأول", "ربيع الثاني",
  "جمادى الأولى", "جمادى الآخرة", "رجب", "شعبان",
  "رمضان", "شوّال", "ذو القعدة", "ذو الحجة",
];

export function formatHijriArabic(hijriStr: string): string {
  const parts = hijriStr.split("/").map(Number);
  if (parts.length !== 3) return hijriStr;
  const [year, month, day] = parts;
  const monthName = HIJRI_MONTHS[month - 1] || "";
  return `${day} ${monthName} ${year} هـ`;
}
