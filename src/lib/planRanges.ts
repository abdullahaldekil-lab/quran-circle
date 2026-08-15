// Validation helpers for the "previous memorization" ranges inside the annual plan form.
// A range point is free text such as "البقرة 1" — a name plus a number.

export interface PlanRange {
  juz: number | "";
  from: string;
  to: string;
  pages: number;
}

export interface ParsedPoint {
  name: string;
  num: number | null;
}

const ARABIC_DIGITS: Record<string, string> = {
  "٠": "0", "١": "1", "٢": "2", "٣": "3", "٤": "4",
  "٥": "5", "٦": "6", "٧": "7", "٨": "8", "٩": "9",
};

export const normalizeDigits = (text: string) =>
  text.replace(/[٠-٩]/g, (d) => ARABIC_DIGITS[d] ?? d);

export const parsePoint = (raw: string): ParsedPoint => {
  const text = normalizeDigits((raw || "").trim());
  const match = text.match(/(\d+(?:\.\d+)?)\s*$/);
  const num = match ? Number(match[1]) : null;
  const name = (match ? text.slice(0, match.index) : text).trim().replace(/\s+/g, " ");
  return { name, num };
};

export type RangeField = "from" | "to" | "pages" | "range";

export interface RangeError {
  /** Which input needs fixing — used to highlight the field. */
  field: RangeField;
  /** Short reason shown next to the field. */
  message: string;
  /** Other position (1-based) involved, for overlap errors. */
  conflictsWith?: number;
}

/** Errors keyed by range index, plus a flat list for the summary alert. */
export interface RangeValidation {
  rowErrors: Record<number, RangeError>;
  /** Detailed messages, each prefixed with the position number. */
  messages: string[];
  valid: boolean;
}

const isFilled = (r: PlanRange) =>
  r.juz !== "" || !!(r.from || "").trim() || !!(r.to || "").trim() || Number(r.pages) > 0;

const pos = (i: number) => `الموضع ${i + 1}`;

export const validatePlanRanges = (ranges: PlanRange[]): RangeValidation => {
  const rowErrors: Record<number, RangeError> = {};

  ranges.forEach((r, i) => {
    if (!isFilled(r)) return;

    const from = (r.from || "").trim();
    const to = (r.to || "").trim();

    if (!from && !to) {
      rowErrors[i] = { field: "from", message: "حقلا «من» و«إلى» فارغان — يرجى تحديد بداية ونهاية الموضع" };
      return;
    }
    if (!from) {
      rowErrors[i] = { field: "from", message: "حقل «من» فارغ — يرجى تحديد بداية الموضع" };
      return;
    }
    if (!to) {
      rowErrors[i] = { field: "to", message: "حقل «إلى» فارغ — يرجى تحديد نهاية الموضع" };
      return;
    }

    const pages = Number(r.pages);
    if (!Number.isFinite(pages) || pages <= 0) {
      rowErrors[i] = {
        field: "pages",
        message: `عدد الأوجه (${r.pages || 0}) غير صحيح — يجب أن يكون رقماً أكبر من صفر`,
      };
      return;
    }

    const a = parsePoint(from);
    const b = parsePoint(to);
    if (a.num !== null && b.num !== null && a.name === b.name && a.num > b.num) {
      rowErrors[i] = {
        field: "from",
        message: `«من» (${from}) أكبر من «إلى» (${to}) — يجب أن يكون «من» أقل من أو يساوي «إلى»`,
      };
    }
  });

  // Overlap detection between comparable ranges (same juz and same name, numeric bounds).
  const comparable = ranges
    .map((r, i) => ({ i, r, a: parsePoint(r.from || ""), b: parsePoint(r.to || "") }))
    .filter((x) => isFilled(x.r) && !rowErrors[x.i] && x.a.num !== null && x.b.num !== null);

  for (let x = 0; x < comparable.length; x++) {
    for (let y = x + 1; y < comparable.length; y++) {
      const p = comparable[x];
      const q = comparable[y];
      if (String(p.r.juz) !== String(q.r.juz)) continue;
      if (p.a.name !== q.a.name) continue;
      const overlap = (p.a.num as number) <= (q.b.num as number) && (q.a.num as number) <= (p.b.num as number);
      if (overlap) {
        const label = p.a.name ? `${p.a.name} ` : "";
        if (!rowErrors[p.i]) {
          rowErrors[p.i] = {
            field: "range",
            conflictsWith: q.i + 1,
            message: `تداخل مع ${pos(q.i)} (${label}${q.a.num}-${q.b.num}) — يرجى تعديل «من» أو «إلى»`,
          };
        }
        if (!rowErrors[q.i]) {
          rowErrors[q.i] = {
            field: "range",
            conflictsWith: p.i + 1,
            message: `تداخل مع ${pos(p.i)} (${label}${p.a.num}-${p.b.num}) — يرجى تعديل «من» أو «إلى»`,
          };
        }
      }
    }
  }

  const messages = Object.keys(rowErrors)
    .map(Number)
    .sort((m, n) => m - n)
    .map((i) => `${pos(i)}: ${rowErrors[i].message}`);

  return { rowErrors, messages, valid: messages.length === 0 };
};
