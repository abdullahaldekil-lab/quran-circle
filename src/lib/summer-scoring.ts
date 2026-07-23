// Pure scoring helpers for the summer maqra daily card.
// Two plan types share the same 40-point structure but differ in bonuses.
//   hifz   = new(15) + link(15) + listening(5) + repetitions(5)      = 40
//   taahud = new(15) + link(15) + test(5)      + amyal(5)            = 40

export type PlanType = "hifz" | "taahud";

export interface DailyRecordInput {
  plan_type: PlanType;
  // new portion
  new_notifications: number;
  new_mistakes_lahn: number;
  new_listening_done: boolean;   // hifz only bonus
  new_repetitions_done: boolean; // hifz only bonus
  new_test_score: number;        // taahud only bonus (0..5)
  // linking on reciter
  link_notifications: number;
  link_mistakes_lahn: number;
  // amyal
  amyal_score: number;           // taahud only (0..5)
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

// The "raw" 10-point base within a 15-point section, penalized by
// notifications (0.5 each) and mistakes/lahn (1 each). Then + bonuses = 15.
const sectionBase = (notifications: number, mistakes: number) =>
  clamp(10 - (notifications * 0.5) - mistakes, 0, 10);

export const calcNewScore = (r: DailyRecordInput): number => {
  const base = sectionBase(r.new_notifications, r.new_mistakes_lahn);
  const bonus =
    r.plan_type === "hifz"
      ? (r.new_listening_done ? 2.5 : 0) + (r.new_repetitions_done ? 2.5 : 0)
      : clamp(r.new_test_score, 0, 5);
  return Math.round(clamp(base + bonus, 0, 15) * 10) / 10;
};

export const calcLinkScore = (r: DailyRecordInput): number => {
  // Link section: 15 points, no built-in bonuses beyond the section base
  // (scaled from 10 -> 15 by adding a fixed 5 execution credit when the row
  // is entered — matches the printed card where "المقرئ" filling implies 5).
  const base = sectionBase(r.link_notifications, r.link_mistakes_lahn);
  return Math.round(clamp(base + 5, 0, 15) * 10) / 10;
};

export const calcAmyalScore = (r: DailyRecordInput): number =>
  r.plan_type === "taahud" ? clamp(r.amyal_score, 0, 5) : 0;

// Total is always out of 40:
//   hifz   = new(0..15) + link(0..15) + engagement(10, day completion)
//   taahud = new(0..15) + link(0..15) + link_execution(5) + amyal(0..5)
export const calcTotalScore = (r: DailyRecordInput): number => {
  const n = calcNewScore(r);
  const l = calcLinkScore(r);
  const tail = r.plan_type === "hifz" ? 10 : 5 + clamp(r.amyal_score, 0, 5);
  return Math.round(clamp(n + l + tail, 0, 40) * 10) / 10;
};

export const PLAN_TRACKS: Record<PlanType, string[]> = {
  hifz: ["حفظ وجه", "حفظ وجهين"],
  taahud: ["إتقان وجهين", "إتقان 3 أوجه", "إتقان 4 أوجه", "إتقان 5 أوجه", "إتقان جزء"],
};
