import { describe, expect, it } from "vitest";
import {
  ACADEMIC_YEAR,
  countStudyDays,
  isStudyDay,
  nextStudyDay,
  termForDate,
  termStudyDays,
} from "./academicYear";

describe("التقويم الدراسي 1448", () => {
  it("يبدأ العام من عودة الطلاب لا من عودة المعلمين", () => {
    expect(ACADEMIC_YEAR.start).toBe("2026-08-23");
    expect(isStudyDay("2026-08-16")).toBe(false); // عودة المعلمين — غير محسوبة
    expect(isStudyDay("2026-08-23")).toBe(true);
  });

  it("يحدد الفصل الدراسي لكل تاريخ", () => {
    expect(termForDate("2026-10-01")?.key).toBe("first");
    expect(termForDate("2027-03-15")?.key).toBe("second");
    expect(termForDate("2027-01-12")).toBeNull(); // إجازة بين الفصلين
  });

  it("يستثني نهاية الأسبوع والإجازات", () => {
    expect(isStudyDay("2026-08-28")).toBe(false); // جمعة
    expect(isStudyDay("2026-09-23")).toBe(false); // اليوم الوطني
    expect(isStudyDay("2027-03-01")).toBe(false); // إجازة عيد الفطر
    expect(isStudyDay("2027-03-14")).toBe(true); // العودة بعد العيد
  });

  it("يحسب أيام الدراسة لكل فصل", () => {
    const [first, second] = ACADEMIC_YEAR.terms;
    expect(termStudyDays(first)).toBeGreaterThan(80);
    expect(termStudyDays(second)).toBeGreaterThan(80);
    expect(countStudyDays("2026-08-23", "2026-08-27")).toBe(5);
    expect(countStudyDays("2027-01-08", "2027-01-16")).toBe(0);
  });

  it("يعيد أول يوم دراسي بعد الإجازة", () => {
    expect(nextStudyDay("2027-01-08")).toBe("2027-01-17");
    expect(nextStudyDay("2027-06-25")).toBeNull();
  });
});
