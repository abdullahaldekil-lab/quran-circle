// Tab resolution for the combined work hub (المهام + الطلبات الداخلية).
//
// The two modules keep their own tables, enums and screens — only the frame is shared.
// Unifying the data would mean altering Postgres enums whose values are Arabic labels
// (`request_status`, `request_priority`, `request_type`), which cannot be done safely
// for a purely presentational gain.

export type WorkTab = "tasks" | "requests" | "analytics";

export const WORK_TABS: WorkTab[] = ["tasks", "requests", "analytics"];

export const WORK_TAB_LABELS: Record<WorkTab, string> = {
  tasks: "المهام",
  requests: "الطلبات الداخلية",
  analytics: "التحليلات",
};

const isWorkTab = (v: unknown): v is WorkTab =>
  typeof v === "string" && (WORK_TABS as string[]).includes(v);

/**
 * Which tab to open. `?tab=` wins, then router state (the notification bell passes
 * `{ tab }` when deep-linking a task or a request), then the default.
 */
export const resolveInitialTab = (
  search: string | URLSearchParams | null | undefined,
  state: { tab?: unknown } | null | undefined,
  fallback: WorkTab = "tasks",
): WorkTab => {
  const params =
    typeof search === "string" ? new URLSearchParams(search) : search ?? new URLSearchParams();
  const fromQuery = params.get("tab");
  if (isWorkTab(fromQuery)) return fromQuery;
  if (isWorkTab(state?.tab)) return state.tab;
  return fallback;
};

/**
 * One badge for the merged nav entry. The sidebar used to carry two separate counts
 * on two separate links.
 */
export const combinedBadgeCount = (
  pendingRequests: number | null | undefined,
  urgentTasks: number | null | undefined,
): number => Math.max(0, Number(pendingRequests) || 0) + Math.max(0, Number(urgentTasks) || 0);

/** Tooltip breaking the merged badge back down. */
export const combinedBadgeTitle = (
  pendingRequests: number | null | undefined,
  urgentTasks: number | null | undefined,
): string => {
  const parts: string[] = [];
  if (Number(urgentTasks) > 0) parts.push(`${urgentTasks} مهمة عاجلة`);
  if (Number(pendingRequests) > 0) parts.push(`${pendingRequests} طلب معلّق`);
  return parts.join(" · ");
};
