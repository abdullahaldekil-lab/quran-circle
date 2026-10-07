import { describe, it, expect } from "vitest";
import { buildNazemRow, type NazemRecord } from "./nazem-export";
import type { Database } from "@/integrations/supabase/types";

// Compile-time guard: every field NazemRecord declares must be a real column on
// `recitation_records`, because those field names are what the page passes to
// PostgREST `.select()`. Selecting a non-existent column fails at runtime with no
// type error — that is exactly how this export stayed broken (it asked for
// `memorization_grade`, which lives on `madarij_hizb_exams`, not here).
type RecitationRow = Database["public"]["Tables"]["recitation_records"]["Row"];
type KeysExistOn<T, Source> = keyof T extends keyof Source ? true : never;
const _everyFieldIsARealColumn: KeysExistOn<NazemRecord, RecitationRow> = true;
void _everyFieldIsARealColumn;

const students = new Map([
  ["s1", { id: "s1", full_name: "أديب الحميد", national_id: "1234567890", student_code: "HW37794" }],
]);
const halaqat = new Map([
  ["h1", { id: "h1", name: "حلقة النور", teacher_id: "t1" }],
]);
const teachers = new Map([
  ["t1", { id: "t1", full_name: "الأستاذ خالد" }],
]);

describe("nazem export row builder", () => {
  it("maps a complete recitation record to Arabic-labelled columns", () => {
    const row = buildNazemRow(
      {
        student_id: "s1",
        halaqa_id: "h1",
        record_date: "2026-05-01",
        memorized_from: "البقرة 1",
        memorized_to: "البقرة 5",
        total_score: 92,
        notes: "أداء جيد",
        mistakes_breakdown: { memorization: { error: 1, lahn: 2, warning: 3 } },
      },
      students,
      halaqat,
      teachers,
    );

    expect(row).toEqual({
      "التاريخ": "2026-05-01",
      "اسم الطالب": "أديب الحميد",
      "رقم الهوية": "1234567890",
      "عمل ولي الأمر": "",
      "كود الطالب": "HW37794",
      "الحلقة": "حلقة النور",
      "المعلم": "الأستاذ خالد",
      "من": "البقرة 1",
      "إلى": "البقرة 5",
      "الدرجة": 92,
      "أخطاء": 1,
      "لحن": 2,
      "تنبيه": 3,
      "ملاحظات": "أداء جيد",
    });
  });

  it("uses memorization breakdown only (ignores review/linking)", () => {
    const row = buildNazemRow(
      {
        student_id: "s1",
        halaqa_id: "h1",
        record_date: "2026-05-02",
        total_score: 100,
        mistakes_breakdown: {
          memorization: { error: 0, lahn: 0, warning: 0 },
          review: { error: 9, lahn: 9, warning: 9 },
          linking: { error: 9, lahn: 9, warning: 9 },
        },
      },
      students,
      halaqat,
      teachers,
    );
    expect(row["أخطاء"]).toBe(0);
    expect(row["لحن"]).toBe(0);
    expect(row["تنبيه"]).toBe(0);
  });

  it("falls back to empty strings when related entities are missing", () => {
    const row = buildNazemRow(
      {
        student_id: "unknown",
        halaqa_id: null,
        record_date: "2026-05-03",
      },
      students,
      halaqat,
      teachers,
    );
    expect(row["اسم الطالب"]).toBe("");
    expect(row["الحلقة"]).toBe("");
    expect(row["المعلم"]).toBe("");
    expect(row["الدرجة"]).toBe("");
    expect(row["أخطاء"]).toBe(0);
  });

  it("handles a halaqa with no assigned teacher", () => {
    const halaqatNoTeacher = new Map([["h2", { id: "h2", name: "حلقة الفجر", teacher_id: null }]]);
    const row = buildNazemRow(
      {
        student_id: "s1",
        halaqa_id: "h2",
        record_date: "2026-05-04",
      },
      students,
      halaqatNoTeacher,
      teachers,
    );
    expect(row["الحلقة"]).toBe("حلقة الفجر");
    expect(row["المعلم"]).toBe("");
  });
});

import { buildDailyRows, buildGuardianSummary } from "./nazem-export";
describe("nazem daily & guardian sheets", () => {
  const sm = new Map([["s1", { id: "s1", full_name: "أحمد", guardian_name: "خالد", guardian_work: "معلم" }]]);
  const att = [{ student_id: "s1", attendance_date: "2026-10-04", status: "present" }, { student_id: "s1", attendance_date: "2026-10-05", status: "absent" }];
  const rec = [{ student_id: "s1", record_date: "2026-10-04", memorized_from: "البقرة 1", memorized_to: "البقرة 5", total_score: 90 }];
  it("daily rows merge attendance and recitation", () => {
    const rows = buildDailyRows(rec as any, att, sm as any, new Map());
    expect(rows).toHaveLength(2);
    expect(rows[0]["الحضور"]).toBe("حاضر");
    expect(rows[0]["الحفظ الجديد"]).toBe("البقرة 1 - البقرة 5");
    expect(rows[0]["عمل ولي الأمر"]).toBe("معلم");
  });
  it("guardian summary", () => {
    const [r] = buildGuardianSummary(rec as any, att, sm as any);
    expect(r["نسبة الحضور"]).toBe("50%");
    expect(r["متوسط الدرجات"]).toBe(90);
  });
});
