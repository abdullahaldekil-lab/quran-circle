import type { Participant } from './himmah';

export type PlanRow = { on: boolean; hizbs: number[] };
export type PlanIssue = { student_id: string; message: string };
export const sameHizbs = (a: number[], b: number[]) => a.length === b.length && [...a].sort((x, y) => x - y).every((h, i) => h === [...b].sort((x, y) => x - y)[i]);
/** Only explicit, changed drafts are sent; unrelated historical plans are never revalidated. */
export function planChanges(drafts: Record<string, PlanRow>, participants: Participant[], circles: string[]) {
  const enrolled = new Map(participants.map(p => [p.student_id, p]));
  const plan: { student_id: string; hizbs: number[] }[] = [];
  const remove: string[] = [];
  for (const [id, row] of Object.entries(drafts)) {
    const previous = enrolled.get(id);
    if (previous && !circles.includes(previous.halaqa_id)) continue;
    if (!row.on) { if (previous) remove.push(id); continue; }
    if (!previous || !sameHizbs(previous.hizbs, row.hizbs)) plan.push({ student_id: id, hizbs: row.hizbs });
  }
  return { plan, remove };
}