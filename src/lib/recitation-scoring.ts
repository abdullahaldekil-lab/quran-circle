// Shared scoring utilities for the recitation flow.
// Deductions (out of 100): error = 5, lahn = 2, warning = 1.

export type MistakeSection = { error: number; lahn: number; warning: number };
export type MistakesBreakdown = Record<string, Partial<MistakeSection>>;

export const emptyBreakdown = (): Record<
  "memorization" | "review" | "linking",
  MistakeSection
> => ({
  memorization: { error: 0, lahn: 0, warning: 0 },
  review: { error: 0, lahn: 0, warning: 0 },
  linking: { error: 0, lahn: 0, warning: 0 },
});

export const aggregateCounts = (b: MistakesBreakdown) => {
  let error = 0,
    lahn = 0,
    warning = 0;
  Object.values(b || {}).forEach((sec) => {
    error += Number(sec?.error || 0);
    lahn += Number(sec?.lahn || 0);
    warning += Number(sec?.warning || 0);
  });
  return { error, lahn, warning, total: error + lahn + warning };
};

export const calcScore = (b: MistakesBreakdown): number => {
  const c = aggregateCounts(b);
  return Math.max(0, 100 - c.error * 5 - c.lahn * 2 - c.warning * 1);
};
