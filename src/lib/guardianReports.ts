export const riyadhToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

export function reportRange(mode: "daily" | "weekly", date: string, from: string, to: string) {
  return mode === "daily" ? { from: date, to: date } : { from, to };
}

export function guardianChildCount(links: { guardian_id: string; student_id: string; active: boolean }[], guardianId: string) {
  return new Set(links.filter(l => l.active && l.guardian_id === guardianId).map(l => l.student_id)).size;
}

export const validBehaviorPoints = (value: string) => value.trim() !== "" && Number.isSafeInteger(Number(value));