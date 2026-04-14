import moment from "moment-hijri";

// Configure moment-hijri for Arabic
moment.locale("ar-SA");

const HIJRI_MONTHS = [
  "محرّم", "صفر", "ربيع الأول", "ربيع الثاني",
  "جمادى الأولى", "جمادى الآخرة", "رجب", "شعبان",
  "رمضان", "شوّال", "ذو القعدة", "ذو الحجة",
];

const GREGORIAN_MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

const WEEKDAYS = [
  "الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت",
];

/**
 * Convert a Gregorian Date to Hijri object
 */
export function toHijri(date: Date | string): { year: number; month: number; day: number } {
  const m = moment(date);
  return {
    year: m.iYear(),
    month: m.iMonth() + 1, // 1-indexed
    day: m.iDate(),
  };
}

/**
 * Convert a Hijri date to Gregorian Date
 */
export function toMiladi(hijriYear: number, hijriMonth: number, hijriDay: number): Date {
  const m = moment(`${hijriYear}/${hijriMonth}/${hijriDay}`, "iYYYY/iM/iD");
  return m.toDate();
}

/**
 * Format Hijri date for display: "15 رمضان 1447 هـ"
 */
export function formatHijriArabic(date: Date | string): string {
  const hijri = toHijri(date);
  const monthName = HIJRI_MONTHS[hijri.month - 1] || "";
  return `${hijri.day} ${monthName} ${hijri.year} هـ`;
}

/**
 * Format Gregorian date in Arabic: "4 مارس 2026"
 */
export function formatGregorianArabic(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const monthName = GREGORIAN_MONTHS[d.getMonth()];
  return `${d.getDate()} ${monthName} ${d.getFullYear()}`;
}

/**
 * Get weekday name in Arabic
 */
export function getWeekdayArabic(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return WEEKDAYS[d.getDay()];
}

/**
 * Format full date header: "الأربعاء، 15 رمضان 1447 (4 مارس 2026)"
 */
export function formatFullDateHeader(date: Date | string): string {
  const weekday = getWeekdayArabic(date);
  const hijri = formatHijriArabic(date);
  const gregorian = formatGregorianArabic(date);
  return `${weekday}، ${hijri} (${gregorian})`;
}

/**
 * Format dual date display: returns both Hijri (primary) and Gregorian (secondary)
 */
export function formatDualDate(date: Date | string): { hijri: string; gregorian: string } {
  return {
    hijri: formatHijriArabic(date),
    gregorian: formatGregorianArabic(date),
  };
}

/**
 * Get current Hijri date string
 */
export function getCurrentHijriDate(): string {
  return formatHijriArabic(new Date());
}

/**
 * Get current full date header
 */
export function getCurrentFullDateHeader(): string {
  return formatFullDateHeader(new Date());
}

/**
 * Legacy function for backward compatibility
 */
export function gregorianToHijri(date: Date): string {
  const hijri = toHijri(date);
  const m = String(hijri.month).padStart(2, "0");
  const d = String(hijri.day).padStart(2, "0");
  return `${hijri.year}/${m}/${d}`;
}

/**
 * Convert Hijri string (YYYY/MM/DD) to Gregorian Date
 */
export function hijriToGregorian(hijriStr: string): Date | null {
  try {
    const parts = hijriStr.split("/").map(Number);
    if (parts.length !== 3) return null;
    const [year, month, day] = parts;
    return toMiladi(year, month, day);
  } catch {
    return null;
  }
}

/**
 * Parse Hijri date from string format
 */
export function parseHijriString(hijriStr: string): { year: number; month: number; day: number } | null {
  try {
    const parts = hijriStr.split("/").map(Number);
    if (parts.length !== 3) return null;
    return { year: parts[0], month: parts[1], day: parts[2] };
  } catch {
    return null;
  }
}

/**
 * Format an already-Hijri string (YYYY/MM/DD) into Arabic display: "15 رمضان 1447 هـ"
 * Use this instead of formatHijriArabic when the input is already a Hijri date string.
 */
export function formatHijriStringArabic(hijriStr: string): string {
  if (!hijriStr) return hijriStr;
  const parts = hijriStr.split("/").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return hijriStr;
  const [year, month, day] = parts;
  if (month < 1 || month > 12 || day < 1 || day > 31) return hijriStr;
  const monthName = HIJRI_MONTHS[month - 1] || "";
  return `${day} ${monthName} ${year} هـ`;
}

/**
 * Detect if a string looks like a Hijri date (YYYY/MM/DD where year > 1300 and < 1500)
 */
export function isHijriString(str: string): boolean {
  if (!str || typeof str !== "string") return false;
  const parts = str.split("/").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return false;
  const [year] = parts;
  return year >= 1300 && year <= 1500;
}

/**
 * Smart date formatter: auto-detects Hijri vs Gregorian input
 * Returns Hijri as primary with Gregorian as secondary in parentheses
 * Input can be: Date object, ISO string, Gregorian date string, or Hijri string (YYYY/MM/DD)
 */
export function formatDateSmart(date: Date | string): string {
  if (!date) return "";
  const str = typeof date === "string" ? date : "";

  // If it's already a Hijri string like "1447/09/15"
  if (str && isHijriString(str)) {
    const hijriDisplay = formatHijriStringArabic(str);
    const gregDate = hijriToGregorian(str);
    const gregDisplay = gregDate ? formatGregorianArabic(gregDate) : "";
    return gregDisplay ? `${hijriDisplay} (${gregDisplay})` : hijriDisplay;
  }

  // Otherwise treat as Gregorian
  const hijriDisplay = formatHijriArabic(date);
  const gregDisplay = formatGregorianArabic(date);
  return `${hijriDisplay} (${gregDisplay})`;
}

/**
 * Smart date formatter returning only Hijri part
 */
export function formatDateHijriOnly(date: Date | string): string {
  if (!date) return "";
  const str = typeof date === "string" ? date : "";
  if (str && isHijriString(str)) return formatHijriStringArabic(str);
  return formatHijriArabic(date);
}

/**
 * Smart dual date: returns { hijri, gregorian } regardless of input type
 */
export function formatDualDateSmart(date: Date | string): { hijri: string; gregorian: string } {
  if (!date) return { hijri: "", gregorian: "" };
  const str = typeof date === "string" ? date : "";

  if (str && isHijriString(str)) {
    const gregDate = hijriToGregorian(str);
    return {
      hijri: formatHijriStringArabic(str),
      gregorian: gregDate ? formatGregorianArabic(gregDate) : "",
    };
  }

  return {
    hijri: formatHijriArabic(date),
    gregorian: formatGregorianArabic(date),
  };
}

/**
 * Format a date+time as Hijri with 12h clock: "15 رمضان 1447 هـ 03:45 م"
 */
export function formatDateTimeSmart(date: Date | string): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  const hijri = formatDateHijriOnly(date);
  const hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const period = hours >= 12 ? "م" : "ص";
  const h12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${hijri} ${h12}:${minutes} ${period}`;
}

/**
 * Format time only in 12h: "03:45 م"
 */
export function formatTime12h(date: Date | string): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  const hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, "0");
  const period = hours >= 12 ? "م" : "ص";
  const h12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  return `${h12}:${minutes} ${period}`;
}

export { HIJRI_MONTHS, GREGORIAN_MONTHS, WEEKDAYS };
