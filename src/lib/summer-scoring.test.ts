import { describe, it, expect } from "vitest";
import {
  calcNewScore, calcLinkScore, calcTotalScore, calcRepetitionScore,
  calcListeningScore, calcPeerLinkScore, evaluateNewPortion, evaluateLink,
  effectiveNotifications, trackRequirement, isHizbTimeValid,
  juzRangeToPages, computeWorkingDays, computeDailyPagesWorking, planDaysNeeded,
  type DailyRecordInput,
} from "./summer-scoring";

const base: DailyRecordInput = {
  plan_type: "hifz",
  plan_track: "حفظ وجه",
  new_notifications: 0,
  new_mistakes_lahn: 0,
  link_notifications: 0,
  link_mistakes_lahn: 0,
  listening_count: 0,
  repetitions_count: 0,
  link_peer_score: 0,
};

describe("summer-scoring — بطاقة الحفظ", () => {
  it("بطاقة كاملة = 40", () => {
    const r: DailyRecordInput = { ...base, listening_count: 3, repetitions_count: 25 };
    expect(calcNewScore(r)).toBe(15);
    expect(calcLinkScore(r)).toBe(15);
    expect(calcListeningScore(r)).toBe(5);
    expect(calcRepetitionScore(r)).toBe(5);
    expect(calcTotalScore(r)).toBe(40);
  });

  it("الخطأ = -3 والتنبيه = -1", () => {
    expect(calcNewScore({ ...base, new_mistakes_lahn: 1 })).toBe(12);
    expect(calcNewScore({ ...base, new_notifications: 2 })).toBe(13);
    expect(calcNewScore({ ...base, new_mistakes_lahn: 1, new_notifications: 2 })).toBe(10);
  });

  it("لا تنزل الدرجة عن صفر", () => {
    expect(calcNewScore({ ...base, new_mistakes_lahn: 40, new_notifications: 40 })).toBe(0);
  });

  it("التكرار والاستماع يُحتسبان نسبةً من المطلوب", () => {
    expect(calcRepetitionScore({ ...base, repetitions_count: 0 })).toBe(0);
    expect(calcRepetitionScore({ ...base, repetitions_count: 13 })).toBe(2.6);
    expect(calcRepetitionScore({ ...base, repetitions_count: 99 })).toBe(5);
    expect(calcListeningScore({ ...base, listening_count: 3 })).toBe(5);
  });

  it("رسوب المقدار الجديد حسب آلية البطاقة", () => {
    expect(evaluateNewPortion("hifz", 0, 2).passed).toBe(false);
    expect(evaluateNewPortion("hifz", 3, 1).passed).toBe(false);
    expect(evaluateNewPortion("hifz", 6, 0).passed).toBe(false);
    expect(evaluateNewPortion("hifz", 5, 0).passed).toBe(true);
    expect(evaluateNewPortion("hifz", 2, 1).passed).toBe(true);
  });

  it("رسوب الربط عند الخطأ الرابع أو ما يعادله", () => {
    expect(evaluateLink("hifz", 0, 4).passed).toBe(false);
    expect(evaluateLink("hifz", 12, 0).passed).toBe(false);
    expect(evaluateLink("hifz", 0, 3).passed).toBe(true);
  });
});

describe("summer-scoring — دورة تعاهد", () => {
  const t: DailyRecordInput = { ...base, plan_type: "taahud", plan_track: "إتقان 3 أوجه" };

  it("بطاقة كاملة = 40", () => {
    const r: DailyRecordInput = { ...t, repetitions_count: 10, link_peer_score: 5 };
    expect(calcRepetitionScore(r)).toBe(5);
    expect(calcPeerLinkScore(r)).toBe(5);
    expect(calcTotalScore(r)).toBe(40);
  });

  it("التنبيه يُحتسب من الثالث", () => {
    expect(effectiveNotifications("taahud", 2)).toBe(0);
    expect(effectiveNotifications("taahud", 4)).toBe(2);
    expect(effectiveNotifications("hifz", 2)).toBe(2);
    expect(calcNewScore({ ...t, new_notifications: 2 })).toBe(15);
    expect(calcNewScore({ ...t, new_notifications: 4 })).toBe(13);
  });

  it("رسوب المقدار عند الخطأ الثالث أو ما يعادله", () => {
    expect(evaluateNewPortion("taahud", 0, 3).passed).toBe(false);
    expect(evaluateNewPortion("taahud", 11, 0).passed).toBe(false); // 9 محتسبة = 3 أخطاء
    expect(evaluateNewPortion("taahud", 0, 2).passed).toBe(true);
  });

  it("متطلبات التكرار حسب المسار", () => {
    expect(trackRequirement("taahud", "إتقان وجهين").repetitions).toBe(15);
    expect(trackRequirement("taahud", "إتقان 5 أوجه").repetitions).toBe(7);
    expect(trackRequirement("hifz", "حفظ وجهين").repetitions).toBe(25);
  });

  it("لا درجة استماع في التعاهد", () => {
    expect(calcListeningScore({ ...t, listening_count: 5 })).toBe(0);
  });
});

describe("زمن قراءة الحزب", () => {
  it("لا يقل عن 12 دقيقة", () => {
    expect(isHizbTimeValid(11)).toBe(false);
    expect(isHizbTimeValid(12)).toBe(true);
    expect(isHizbTimeValid(null)).toBe(true);
  });
});

describe("summer-plan (Madinah mushaf distribution)", () => {
  it("juz 1..7 = 140 pages per Madinah mushaf", () => {
    expect(juzRangeToPages(1, 7)).toBe(140);
    expect(juzRangeToPages(1, 1)).toBe(20);
    expect(juzRangeToPages(1, 30)).toBe(600);
  });

  it("invalid juz ranges yield 0", () => {
    expect(juzRangeToPages(0, 5)).toBe(0);
    expect(juzRangeToPages(7, 1)).toBe(0);
  });

  it("counts Sun-Thu only as working days", () => {
    expect(computeWorkingDays("2026-07-19", "2026-07-23")).toBe(5);
    expect(computeWorkingDays("2026-07-19", "2026-07-25")).toBe(5);
    expect(computeWorkingDays("2026-07-19", "2026-08-01")).toBe(10);
  });

  it("excludes official holidays from working days", () => {
    const holidays = [{ start_date: "2026-07-21", end_date: "2026-07-22" }];
    expect(computeWorkingDays("2026-07-19", "2026-07-23", holidays)).toBe(3);
    const weekendHoliday = [{ start_date: "2026-07-24", end_date: "2026-07-25" }];
    expect(computeWorkingDays("2026-07-19", "2026-07-25", weekendHoliday)).toBe(5);
  });

  it("distributes pages over working days, clamped 1..20 per day", () => {
    expect(computeDailyPagesWorking(140, 20)).toBe(7);
    expect(computeDailyPagesWorking(10, 40)).toBe(1);
    expect(computeDailyPagesWorking(600, 10)).toBe(20);
    expect(computeDailyPagesWorking(140, 0)).toBe(0);
  });

  it("daily wajh is always a whole number, rounded up", () => {
    expect(computeDailyPagesWorking(140, 45)).toBe(4);
    expect(computeDailyPagesWorking(100, 7)).toBe(15);
    expect(computeDailyPagesWorking(20, 6)).toBe(4);
    expect(planDaysNeeded(140, 4)).toBe(35);
    expect(planDaysNeeded(100, 15)).toBe(7);
    expect(planDaysNeeded(0, 5)).toBe(0);
  });
});
