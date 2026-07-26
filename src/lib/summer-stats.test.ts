import { describe, it, expect } from "vitest";
import {
  dailyStats,
  perMaqraStats,
  perSourceHalaqaStats,
  perStudentStats,
  programmeStats,
  weekStartOf,
  weeklyStats,
  type StatAttendance,
  type StatRecord,
  type StatStudent,
} from "./summer-stats";

// 2026-06-07 is a Sunday; 2026-06-12 a Friday and 2026-06-13 a Saturday (weekend).
const TODAY = "2026-06-11"; // Thursday

const student = (over: Partial<StatStudent> = {}): StatStudent => ({
  id: "s1",
  maqra_id: "m1",
  source_halaqa_id: "h1",
  plan_type: "hifz",
  pages_target: 100,
  plan_start_date: "2026-06-07",
  plan_end_date: "2026-07-31",
  ...over,
});

const rec = (over: Partial<StatRecord> = {}): StatRecord => ({
  summer_student_id: "s1",
  record_date: TODAY,
  link_pages_count: 5,
  total_score: 35,
  ...over,
});

const att = (over: Partial<StatAttendance> = {}): StatAttendance => ({
  summer_student_id: "s1",
  attendance_date: TODAY,
  status: "present",
  ...over,
});

describe("perStudentStats", () => {
  it("computes coverage against the target", () => {
    const [r] = perStudentStats([student()], [rec(), rec({ link_pages_count: 15 })], [], [], TODAY);
    expect(r.covered).toBe(20);
    expect(r.target).toBe(100);
    expect(r.progressPct).toBe(20);
    expect(r.status).toBe("behind");
  });

  it("returns 0% rather than NaN when the student has no target", () => {
    const [r] = perStudentStats([student({ pages_target: 0 })], [rec()], [], [], TODAY);
    expect(r.progressPct).toBe(0);
    expect(Number.isNaN(r.progressPct)).toBe(false);
  });

  it("returns zeros for a student with no records at all", () => {
    const [r] = perStudentStats([student()], [], [], [], TODAY);
    expect(r.covered).toBe(0);
    expect(r.avgScore).toBe(0);
    expect(r.attendancePct).toBe(0);
  });

  it("counts late and late_excused as attendance", () => {
    const [r] = perStudentStats(
      [student()],
      [],
      [att({ attendance_date: "2026-06-08", status: "late" }), att({ status: "late_excused" })],
      [],
      TODAY,
    );
    expect(r.attendedDays).toBe(2);
  });

  it("removes excused days from the expected-days denominator", () => {
    // Sun 7 → Thu 11 = 5 working days; one excused → denominator 4, attended 4 → 100%
    const days = ["2026-06-07", "2026-06-08", "2026-06-09", "2026-06-10"].map((d) =>
      att({ attendance_date: d }),
    );
    const [r] = perStudentStats([student()], [], [...days, att({ status: "excused" })], [], TODAY);
    expect(r.expectedDays).toBe(4);
    expect(r.attendancePct).toBe(100);
  });

  it("excludes holidays from expected days", () => {
    const [r] = perStudentStats([student()], [], [], [{ start_date: "2026-06-08", end_date: "2026-06-09" }], TODAY);
    expect(r.expectedDays).toBe(3); // 5 working days minus 2 holiday days
  });

  it("never counts days past the plan end", () => {
    const [r] = perStudentStats(
      [student({ plan_end_date: "2026-06-08" })],
      [], [], [], TODAY,
    );
    expect(r.expectedDays).toBe(2); // Sun 7 + Mon 8 only
  });

  it("classifies progress at the boundaries", () => {
    const at100 = perStudentStats([student({ pages_target: 10 })], [rec({ link_pages_count: 10 })], [], [], TODAY)[0];
    const at70 = perStudentStats([student({ pages_target: 10 })], [rec({ link_pages_count: 7 })], [], [], TODAY)[0];
    expect(at100.status).toBe("ahead");
    expect(at70.status).toBe("on_track");
  });
});

describe("perMaqraStats", () => {
  it("rolls students up per maqra and sorts by progress", () => {
    const students = [
      student({ id: "a", maqra_id: "m1", pages_target: 10 }),
      student({ id: "b", maqra_id: "m2", pages_target: 10 }),
    ];
    const records = [
      rec({ summer_student_id: "a", link_pages_count: 9 }),
      rec({ summer_student_id: "b", link_pages_count: 1 }),
    ];
    const per = perStudentStats(students, records, [], [], TODAY);
    const rows = perMaqraStats(
      [{ id: "m1", name: "مقرأة أ" }, { id: "m2", name: "مقرأة ب" }],
      per,
    );
    expect(rows[0].id).toBe("m1");
    expect(rows[0].progressPct).toBe(90);
    expect(rows[1].progressPct).toBe(10);
  });

  it("shows an empty maqra without dividing by zero", () => {
    const rows = perMaqraStats([{ id: "m9", name: "فارغة" }], []);
    expect(rows[0].students).toBe(0);
    expect(rows[0].progressPct).toBe(0);
  });
});

describe("perSourceHalaqaStats", () => {
  it("reports the share of each halaqa that joined, not just a count", () => {
    const per = perStudentStats(
      [student({ id: "a", source_halaqa_id: "h1" }), student({ id: "b", source_halaqa_id: "h1" })],
      [], [], [], TODAY,
    );
    const rows = perSourceHalaqaStats([{ id: "h1", name: "حلقة النور" }], per, { h1: 8 });
    expect(rows[0].students).toBe(2);
    expect(rows[0].halaqaSize).toBe(8);
    expect(rows[0].participationPct).toBe(25);
  });

  it("drops halaqat with nobody in the programme", () => {
    expect(perSourceHalaqaStats([{ id: "h2", name: "بلا مشاركين" }], [], { h2: 10 })).toEqual([]);
  });

  it("does not divide by zero when the halaqa size is unknown", () => {
    const per = perStudentStats([student({ source_halaqa_id: "h1" })], [], [], [], TODAY);
    expect(perSourceHalaqaStats([{ id: "h1", name: "x" }], per)[0].participationPct).toBe(0);
  });
});

describe("dailyStats", () => {
  it("summarises one day", () => {
    const snap = dailyStats(
      [student({ id: "a" }), student({ id: "b" })],
      [rec({ summer_student_id: "a", link_pages_count: 4, total_score: 30 })],
      [att({ summer_student_id: "a" }), att({ summer_student_id: "b", status: "absent" })],
      TODAY,
    );
    expect(snap.enrolled).toBe(2);
    expect(snap.recorded).toBe(1);
    expect(snap.participationPct).toBe(50);
    expect(snap.pagesCovered).toBe(4);
    expect(snap.avgScore).toBe(30);
    expect(snap.attendancePct).toBe(50);
  });

  it("ignores other days", () => {
    const snap = dailyStats([student()], [rec({ record_date: "2026-06-01" })], [], TODAY);
    expect(snap.recorded).toBe(0);
  });

  it("is all zeros with no data", () => {
    const snap = dailyStats([], [], [], TODAY);
    expect(snap.participationPct).toBe(0);
    expect(snap.attendancePct).toBe(0);
  });
});

describe("weeklyStats", () => {
  it("anchors weeks on Sunday", () => {
    expect(weekStartOf("2026-06-11")).toBe("2026-06-07"); // Thursday → Sunday
    expect(weekStartOf("2026-06-07")).toBe("2026-06-07");
  });

  it("returns the requested number of buckets, oldest first", () => {
    const buckets = weeklyStats([], [], TODAY, 3);
    expect(buckets).toHaveLength(3);
    expect(buckets[0].weekStart < buckets[2].weekStart).toBe(true);
    expect(buckets[2].weekStart).toBe("2026-06-07");
  });

  it("buckets records into the right week", () => {
    const buckets = weeklyStats(
      [rec({ record_date: "2026-06-09", link_pages_count: 3 }), rec({ record_date: "2026-06-02", link_pages_count: 7 })],
      [], TODAY, 2,
    );
    expect(buckets[0].pagesCovered).toBe(7);
    expect(buckets[1].pagesCovered).toBe(3);
  });

  it("counts five working days in a normal week", () => {
    expect(weeklyStats([], [], TODAY, 1)[0].workingDays).toBe(5);
  });

  it("drops holiday days from the working count", () => {
    const buckets = weeklyStats([], [], TODAY, 1, [{ start_date: "2026-06-08", end_date: "2026-06-08" }]);
    expect(buckets[0].workingDays).toBe(4);
  });
});

describe("programmeStats", () => {
  it("splits hifz and taahud and totals the programme", () => {
    const per = perStudentStats(
      [
        student({ id: "a", plan_type: "hifz", pages_target: 10 }),
        student({ id: "b", plan_type: "taahud", pages_target: 10 }),
      ],
      [rec({ summer_student_id: "a", link_pages_count: 10 })],
      [], [], TODAY,
    );
    const stats = programmeStats(per);
    expect(stats.totalStudents).toBe(2);
    expect(stats.hifzStudents).toBe(1);
    expect(stats.taahudStudents).toBe(1);
    expect(stats.covered).toBe(10);
    expect(stats.target).toBe(20);
    expect(stats.progressPct).toBe(50);
  });

  it("is safe on an empty programme", () => {
    const stats = programmeStats([]);
    expect(stats.progressPct).toBe(0);
    expect(stats.onTrackPct).toBe(0);
  });
});
