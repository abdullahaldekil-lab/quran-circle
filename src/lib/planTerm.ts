// The term (فصل) dimension on a student's memorization plan.
//
// Plans were annual only, so "الخطة الفصلية" had nowhere to live. Rather than a new
// entity, `student_annual_plans` gained a `term` column: the same plan structure,
// scoped to a term. TEXT + CHECK rather than a Postgres enum — the Arabic enums
// already in this schema are painful to change (no DROP VALUE, and ADD VALUE cannot
// share a transaction with its use).

export type PlanTerm = "annual" | "first" | "second" | "summer";

export const PLAN_TERMS: PlanTerm[] = ["annual", "first", "second", "summer"];

export const TERM_LABELS: Record<PlanTerm, string> = {
  annual: "سنوي",
  first: "الفصل الأول",
  second: "الفصل الثاني",
  summer: "الفصل الصيفي",
};

export const termLabel = (term: string | null | undefined): string =>
  TERM_LABELS[(term || "annual") as PlanTerm] ?? String(term);

export interface PlanLike {
  id?: string;
  term?: string | null;
  status?: string | null;
  start_date?: string | null;
  end_date?: string | null;
}

const time = (iso?: string | null): number | null => {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return Number.isNaN(t) ? null : t;
};

/** Length of a plan's date range in ms, or Infinity when it is open-ended. */
const span = (plan: PlanLike): number => {
  const start = time(plan.start_date);
  const end = time(plan.end_date);
  if (start == null || end == null) return Number.POSITIVE_INFINITY;
  return end - start;
};

/**
 * The plan that applies on a given date.
 *
 * With terms, a student can legitimately have more than one active plan (an annual one
 * and a summer one, say), so picking the first `status = 'active'` row is no longer
 * enough. Preference order:
 *   1. an active plan whose date range contains the date — narrowest range wins, so a
 *      term plan beats an annual plan that merely overlaps it
 *   2. any active plan
 *   3. null
 */
export const activePlanFor = <T extends PlanLike>(
  plans: T[] | null | undefined,
  onDateISO: string,
): T | null => {
  const active = (plans || []).filter((p) => (p.status ?? "active") === "active");
  if (active.length === 0) return null;

  const at = time(onDateISO);
  if (at == null) return active[0];

  const containing = active.filter((p) => {
    const start = time(p.start_date);
    const end = time(p.end_date);
    if (start != null && at < start) return false;
    if (end != null && at > end) return false;
    return true;
  });

  if (containing.length === 0) return active[0];
  return containing.reduce((best, p) => (span(p) < span(best) ? p : best));
};
