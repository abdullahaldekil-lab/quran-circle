import { useAuth } from "@/hooks/useAuth";

export type StaffRole =
  | "manager"
  | "secretary"
  | "supervisor"
  | "assistant_supervisor"
  | "admin_staff"
  | "teacher"
  | "assistant_teacher"
  | (string & {}); // للأدوار المخصصة

// Role mapping to conceptual RBAC names:
// manager          → super_admin (full access)
// supervisor       → educational_admin
// assistant_supervisor → educational_admin
// secretary        → administrative_admin
// admin_staff      → administrative_admin
// teacher          → teacher
// assistant_teacher → assistant_teacher

// Route-level access per role
const rolePermissions: Record<StaffRole, string[]> = {
  manager: [
    "/dashboard", "/students", "/inactive-students", "/halaqat", "/talqeen-halaqat", "/recitation", "/attendance",
    "/instructions", "/levels", "/rankings", "/rewards", "/trips",
    "/finance", "/strategic-plan", "/strategy", "/kpi-dashboard", "/bulk-import",
    "/user-management", "/profile", "/health", "/documents", "/buses", "/pre-registration", "/enrollment-requests", "/preparation", "/academic-calendar", "/attendance-audit", "/madarij", "/madarij-report",
    "/quran-narration", "/excellence", "/excellence-comparison", "/student-quiz", "/quiz-results", "/quiz-comparison",
    "/narration-test", "/review-test", "/narration-stats",
    "/staff-attendance", "/staff-attendance-log", "/staff-shifts", "/staff-tasks", "/staff-tasks-analytics",
    "/student-attendance-report", "/student-annual-plan",
    "/notification-templates", "/notification-log", "/notification-preferences",
    "/send-notification", "/bulk-email",
    "/permissions-management", "/internal-requests",
    "/programs-overview", "/halaqa-performance", "/enrollment-form",
  ],
  supervisor: [
    "/dashboard", "/halaqat", "/talqeen-halaqat", "/recitation", "/kpi-dashboard",
    "/strategic-plan", "/strategy", "/profile", "/documents", "/pre-registration", "/enrollment-requests", "/preparation", "/academic-calendar", "/madarij", "/madarij-report",
    "/quran-narration", "/excellence", "/excellence-comparison", "/excellence/track-settings", "/student-quiz", "/quiz-results", "/quiz-comparison",
    "/narration-test", "/review-test", "/narration-stats",
    "/staff-attendance", "/staff-attendance-log", "/staff-shifts", "/staff-tasks", "/staff-tasks-analytics",
    "/student-attendance-report", "/student-annual-plan",
    "/notification-preferences", "/internal-requests",
    "/programs-overview", "/halaqa-performance", "/enrollment-form",
  ],
  assistant_supervisor: [
    "/dashboard", "/halaqat", "/talqeen-halaqat", "/recitation", "/kpi-dashboard",
    "/strategic-plan", "/strategy", "/profile", "/documents", "/pre-registration", "/enrollment-requests", "/preparation", "/academic-calendar", "/madarij", "/madarij-report",
    "/quran-narration", "/excellence", "/excellence-comparison", "/excellence/track-settings", "/student-quiz", "/quiz-results", "/quiz-comparison",
    "/narration-test", "/review-test", "/narration-stats",
    "/staff-attendance", "/staff-attendance-log", "/staff-shifts", "/staff-tasks", "/staff-tasks-analytics",
    "/student-attendance-report", "/student-annual-plan",
    "/notification-preferences", "/internal-requests",
    "/programs-overview", "/halaqa-performance",
  ],
  secretary: [
    "/dashboard", "/students", "/halaqat", "/talqeen-halaqat", "/attendance",
    "/bulk-import", "/trips", "/profile", "/buses", "/pre-registration", "/enrollment-requests", "/preparation", "/academic-calendar",
    "/quran-narration",
    "/staff-attendance", "/staff-attendance-log", "/staff-shifts",
    "/student-attendance-report",
    "/notification-preferences", "/internal-requests", "/staff-tasks", "/staff-tasks-analytics",
    "/enrollment-form",
  ],
  admin_staff: [
    "/dashboard", "/students", "/halaqat", "/talqeen-halaqat", "/attendance",
    "/bulk-import", "/trips", "/profile", "/buses", "/pre-registration", "/enrollment-requests", "/preparation", "/academic-calendar",
    "/quran-narration",
    "/staff-attendance", "/staff-attendance-log",
    "/student-attendance-report",
    "/notification-preferences", "/internal-requests", "/staff-tasks", "/staff-tasks-analytics",
  ],
  teacher: [
    "/dashboard", "/students", "/halaqat", "/talqeen-halaqat", "/recitation", "/attendance",
    "/rankings", "/trips", "/profile", "/buses", "/preparation", "/academic-calendar", "/madarij",
    "/quran-narration", "/excellence", "/excellence-comparison", "/student-quiz", "/quiz-results", "/quiz-comparison",
    "/narration-test", "/review-test", "/narration-stats",
    "/staff-attendance-log",
    "/student-attendance-report", "/student-annual-plan",
    "/notification-preferences", "/internal-requests", "/staff-tasks", "/staff-tasks-analytics",
    "/enrollment-form",
  ],
  assistant_teacher: [
    "/dashboard", "/students", "/halaqat", "/talqeen-halaqat", "/recitation", "/attendance",
    "/rankings", "/profile", "/preparation", "/academic-calendar",
    "/quran-narration",
    "/staff-attendance-log",
    "/notification-preferences", "/internal-requests", "/staff-tasks", "/staff-tasks-analytics",
  ],
};

// Resource-level write permissions per role
type Resource =
  | "students" | "halaqat" | "recitation" | "attendance"
  | "instructions" | "levels" | "rankings" | "rewards"
  | "trips" | "finance" | "strategic_goals" | "strategic_objectives"
  | "strategic_tasks" | "user_management" | "bulk_import" | "guardians";

const roleWritePermissions: Record<StaffRole, Resource[]> = {
  manager: [
    "students", "halaqat", "recitation", "attendance", "instructions",
    "levels", "rankings", "rewards", "trips", "finance",
    "strategic_goals", "strategic_objectives", "strategic_tasks",
    "user_management", "bulk_import", "guardians",
  ],
  supervisor: [
    "strategic_tasks", "strategic_objectives",
  ],
  assistant_supervisor: [
    "strategic_tasks",
  ],
  secretary: [
    "students", "attendance", "bulk_import", "trips",
  ],
  admin_staff: [
    "students", "attendance", "bulk_import", "trips",
  ],
  teacher: [
    "recitation", "attendance", "trips",
  ],
  assistant_teacher: [
    "recitation", "attendance",
  ],
  // مشرف التلقين — صلاحيات كتابة كاملة على قسم التلقين والطلاب والحلقات والحضور
  custom_1775663809732: [
    "students", "halaqat", "recitation", "attendance",
    "bulk_import", "trips",
  ],
};

// مسارات الوصول لمشرف التلقين (قسم التلقين بالكامل من تسجيل الطلاب حتى متابعة الجلسات والواجبات)
const talqeenSupervisorRoutes = [
  "/dashboard", "/profile",
  "/talqeen-halaqat",
  "/students", "/inactive-students", "/halaqat",
  "/recitation", "/attendance", "/student-attendance-report",
  "/bulk-import", "/pre-registration", "/enrollment-requests", "/enrollment-form",
  "/preparation", "/academic-calendar",
  "/staff-attendance-log", "/staff-tasks", "/staff-tasks-analytics",
  "/notification-preferences", "/internal-requests",
  "/programs-overview", "/halaqa-performance",
  "/documents", "/rankings", "/trips", "/buses",
];

export const useRole = () => {
  const { profile } = useAuth();
  const role = (profile?.role as StaffRole) || "teacher";

  const allowedRoutes =
    role === "custom_1775663809732"
      ? talqeenSupervisorRoutes
      : (rolePermissions[role] || rolePermissions.teacher);

  const allowedRoutes = rolePermissions[role] || rolePermissions.teacher;

  const hasAccess = (path: string) => {
    return allowedRoutes.some(
      (route) => path === route || path.startsWith(route + "/")
    );
  };

  const canWrite = (resource: Resource): boolean => {
    const perms = roleWritePermissions[role] || [];
    return perms.includes(resource);
  };

  const isManager = role === "manager";
  const isSupervisor = role === "supervisor" || role === "assistant_supervisor";
  const isAdminStaff = role === "admin_staff" || role === "secretary";
  const isTeacher = role === "teacher" || role === "assistant_teacher";

  return {
    role,
    hasAccess,
    canWrite,
    allowedRoutes,
    isManager,
    isSupervisor,
    isAdminStaff,
    isTeacher,
  };
};
