// Types
export interface NarrationRange {
  id?: string;
  section: "regular" | "first_third" | "second_third" | "third_third";
  from_hizb: number;
  to_hizb: number;
  hizb_count: number;
}

export interface NarrationAttemptData {
  narration_type: "regular" | "multi";
  ranges: NarrationRange[];
  total_hizb_count: number;
  total_pages_approx: number;
  mistakes_count: number;
  lahn_count: number;
  warnings_count: number;
  grade: number;
  status: "pass" | "fail" | "absent" | "pending";
  manual_entry: boolean;
  notes: string;
}

export interface NarrationSettingsFull {
  id: string;
  min_grade: number;
  max_grade: number;
  deduction_per_mistake: number;
  deduction_per_lahn: number;
  deduction_per_warning: number;
  pages_per_hizb: number;
  min_hizb_required: number;
  min_pages_required: number;
  memorization_weight: number;
  mastery_weight: number;
  performance_weight: number;
}

// Section limits
export const SECTION_LIMITS: Record<string, { min: number; max: number; label: string }> = {
  first_third: { min: 1, max: 20, label: "الثلث الأول (١-٢٠)" },
  second_third: { min: 21, max: 40, label: "الثلث الثاني (٢١-٤٠)" },
  third_third: { min: 41, max: 60, label: "الثلث الثالث (٤١-٦٠)" },
};

// Calculate hizb count for a range
export function calcRangeHizbCount(from: number, to: number): number {
  if (from > to || from < 1 || to > 60) return 0;
  return to - from + 1;
}

// Calculate total hizb count from all ranges
export function calcTotalHizbCount(ranges: NarrationRange[]): number {
  return ranges.reduce((sum, r) => sum + calcRangeHizbCount(r.from_hizb, r.to_hizb), 0);
}

// Calculate approximate pages
export function calcTotalPages(totalHizb: number, pagesPerHizb: number = 10): number {
  return totalHizb * pagesPerHizb;
}

// Validate a single range is within section bounds
export function validateRangeInSection(range: NarrationRange): string | null {
  if (range.from_hizb > range.to_hizb) {
    return "بداية الحزب يجب أن تكون أقل من أو تساوي نهاية الحزب";
  }
  if (range.from_hizb < 1 || range.to_hizb > 60) {
    return "رقم الحزب يجب أن يكون بين 1 و 60";
  }
  if (range.section !== "regular") {
    const limits = SECTION_LIMITS[range.section];
    if (limits) {
      if (range.from_hizb < limits.min || range.to_hizb > limits.max) {
        return `النطاق يجب أن يكون ضمن حدود ${limits.label}`;
      }
    }
  }
  return null;
}

// Check for overlapping ranges within same section
export function checkOverlap(ranges: NarrationRange[]): string | null {
  for (let i = 0; i < ranges.length; i++) {
    for (let j = i + 1; j < ranges.length; j++) {
      if (ranges[i].section === ranges[j].section) {
        if (ranges[i].from_hizb <= ranges[j].to_hizb && ranges[j].from_hizb <= ranges[i].to_hizb) {
          return `يوجد تداخل في النطاقات ضمن ${SECTION_LIMITS[ranges[i].section]?.label || "النطاق"}`;
        }
      }
    }
  }
  return null;
}

// Full validation
export function validateAttempt(
  data: NarrationAttemptData,
  settings: NarrationSettingsFull
): string[] {
  const errors: string[] = [];

  if (data.ranges.length === 0) {
    errors.push("يجب إضافة نطاق واحد على الأقل");
    return errors;
  }

  // Validate each range
  for (const range of data.ranges) {
    const err = validateRangeInSection(range);
    if (err) errors.push(err);
  }

  // Check overlaps
  const overlapErr = checkOverlap(data.ranges);
  if (overlapErr) errors.push(overlapErr);

  // Check minimum requirements
  const totalHizb = calcTotalHizbCount(data.ranges);
  const totalPages = calcTotalPages(totalHizb, settings.pages_per_hizb);
  if (totalHizb < settings.min_hizb_required && totalPages < settings.min_pages_required) {
    errors.push(`مجموع الأحزاب (${totalHizb}) أقل من الحد الأدنى (${settings.min_hizb_required} حزب أو ${settings.min_pages_required} وجه)`);
  }

  return errors;
}

// Calculate grade automatically
export function calcGrade(
  settings: NarrationSettingsFull,
  mistakes: number,
  lahn: number,
  warnings: number
): number {
  const raw =
    settings.max_grade -
    mistakes * settings.deduction_per_mistake -
    lahn * settings.deduction_per_lahn -
    warnings * settings.deduction_per_warning;
  return Math.max(0, Math.min(settings.max_grade, Math.round(raw * 10) / 10));
}

// Determine status based on grade
export function determineStatus(grade: number, minGrade: number): "pass" | "fail" {
  return grade >= minGrade ? "pass" : "fail";
}
