import { gregorianToHijri as gregToHijri } from "islamic-date";

/**
 * Convert a Gregorian date to Hijri string (YYYY/MM/DD)
 */
export function gregorianToHijri(date: Date): string {
  const result = gregToHijri(date.getFullYear(), date.getMonth() + 1, date.getDate());
  if (!result) return "";
  const y = result.year;
  const m = String(result.month).padStart(2, "0");
  const d = String(result.day).padStart(2, "0");
  return `${y}/${m}/${d}`;
}

/**
 * Convert a Hijri string (YYYY/MM/DD) to Gregorian Date
 * Note: islamic-date doesn't export hijriToGregorian, so we skip reverse conversion
 */
export function hijriToGregorian(_hijriStr: string): Date | null {
  // Library doesn't export reverse conversion - return null
  return null;
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
