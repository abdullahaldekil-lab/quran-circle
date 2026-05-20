import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

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
    "/dashboard", "/students", "/inactive-students", "/halaqat", "/talqeen-halaqat", "/talqeen-programs", "/talqeen-supervisor", "/recitation", "/attendance",
    "/instructions", "/levels", "/rankings", "/rewards", "/trips",
    "/finance", "/strategic-plan", "/strategy", "/kpi-dashboard", "/bulk-import",
    "/user-management", "/profile", "/health", "/documents", "/buses", "/pre-registration", "/enrollment-requests", "/preparation", "/academic-calendar", "/attendance-audit", "/madarij", "/madarij-report", "/talqeen-curricula",
    "/quran-narration", "/excellence", "/excellence-comparison", "/student-quiz", "/quiz-results", "/quiz-comparison",
    "/narration-test", "/review-test", "/narration-stats",
    "/staff-attendance", "/staff-attendance-log", "/staff-shifts", "/staff-tasks", "/staff-tasks-analytics",
    "/student-attendance-report", "/student-annual-plan",
    "/notification-templates", "/notification-log", "/notification-preferences",
    "/send-notification", "/bulk-email",
    "/permissions-management", "/internal-requests",
    "/programs-overview", "/halaqa-performance", "/enrollment-form",
    "/admin/guardian-messages", "/admin/guardian-excuses", "/admin/teacher-evaluations", "/admin/guardian-approvals",
    "/student-portal", "/program-quiz",
  ],
  supervisor: [
    "/dashboard", "/halaqat", "/talqeen-halaqat", "/talqeen-programs", "/talqeen-supervisor", "/recitation", "/kpi-dashboard",
    "/strategic-plan", "/strategy", "/profile", "/documents", "/pre-registration", "/enrollment-requests", "/preparation", "/academic-calendar", "/madarij", "/madarij-report", "/talqeen-curricula",
    "/quran-narration", "/excellence", "/excellence-comparison", "/excellence/track-settings", "/student-quiz", "/quiz-results", "/quiz-comparison",
    "/narration-test", "/review-test", "/narration-stats",
    "/staff-attendance", "/staff-attendance-log", "/staff-shifts", "/staff-tasks", "/staff-tasks-analytics",
    "/student-attendance-report", "/student-annual-plan",
    "/notification-preferences", "/internal-requests",
    "/programs-overview", "/halaqa-performance", "/enrollment-form",
    "/admin/guardian-approvals",
    "/student-portal", "/program-quiz",
  ],
  assistant_supervisor: [
    "/dashboard", "/halaqat", "/talqeen-halaqat", "/talqeen-programs", "/talqeen-supervisor", "/recitation", "/kpi-dashboard",
    "/strategic-plan", "/strategy", "/profile", "/documents", "/pre-registration", "/enrollment-requests", "/preparation", "/academic-calendar", "/madarij", "/madarij-report", "/talqeen-curricula",
    "/quran-narration", "/excellence", "/excellence-comparison", "/excellence/track-settings", "/student-quiz", "/quiz-results", "/quiz-comparison",
    "/narration-test", "/review-test", "/narration-stats",
    "/staff-attendance", "/staff-attendance-log", "/staff-shifts", "/staff-tasks", "/staff-tasks-analytics",
    "/student-attendance-report", "/student-annual-plan",
    "/notification-preferences", "/internal-requests",
    "/programs-overview", "/halaqa-performance",
    "/admin/guardian-approvals", "/program-quiz",
  ],
  secretary: [
    "/dashboard", "/students", "/halaqat", "/talqeen-halaqat", "/talqeen-programs", "/attendance",
    "/bulk-import", "/trips", "/profile", "/buses", "/pre-registration", "/enrollment-requests", "/preparation", "/academic-calendar",
    "/quran-narration",
    "/staff-attendance", "/staff-attendance-log", "/staff-shifts",
    "/student-attendance-report",
    "/notification-preferences", "/notification-log", "/whatsapp-log", "/internal-requests", "/staff-tasks", "/staff-tasks-analytics",
    "/enrollment-form", "/programs-overview",
    "/admin/guardian-messages", "/admin/guardian-excuses", "/admin/guardian-approvals",
    "/student-portal",
  ],
  admin_staff: [
    "/dashboard", "/students", "/halaqat", "/talqeen-halaqat", "/talqeen-programs", "/attendance",
    "/bulk-import", "/trips", "/profile", "/buses", "/pre-registration", "/enrollment-requests", "/preparation", "/academic-calendar",
    "/quran-narration",
    "/staff-attendance", "/staff-attendance-log",
    "/student-attendance-report",
    "/notification-preferences", "/internal-requests", "/staff-tasks", "/staff-tasks-analytics",
  ],
  teacher: [
    "/dashboard", "/students", "/halaqat", "/talqeen-halaqat", "/talqeen-programs", "/recitation", "/attendance",
    "/rankings", "/trips", "/profile", "/buses", "/preparation", "/academic-calendar", "/madarij", "/talqeen-curricula",
    "/quran-narration", "/excellence", "/excellence-comparison", "/student-quiz", "/quiz-results", "/quiz-comparison",
    "/narration-test", "/review-test", "/narration-stats",
    "/staff-attendance-log",
    "/student-attendance-report", "/student-annual-plan",
    "/notification-preferences", "/internal-requests", "/staff-tasks", "/staff-tasks-analytics",
    "/enrollment-form", "/program-quiz",
  ],
  assistant_teacher: [
    "/dashboard", "/students", "/halaqat", "/talqeen-halaqat", "/talqeen-programs", "/recitation", "/attendance",
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
  "/talqeen-halaqat", "/talqeen-programs", "/talqeen-curricula", "/talqeen-supervisor",
  "/students", "/inactive-students", "/halaqat",
  "/recitation", "/attendance", "/student-attendance-report",
  "/bulk-import", "/pre-registration", "/enrollment-requests", "/enrollment-form",
  "/preparation", "/academic-calendar",
  "/staff-attendance-log", "/staff-tasks", "/staff-tasks-analytics",
  "/notification-preferences", "/internal-requests",
  "/programs-overview", "/halaqa-performance",
  "/documents", "/rankings", "/trips", "/buses",
];

// Routes hidden when an assistant_teacher works inside a Talqeen halaqa
// (academic memorization sections do not apply to talqeen-only assistants)
const talqeenIsolatedHidden = [
  "/recitation", "/madarij", "/madarij-report", "/talqeen-curricula",
  "/quran-narration", "/narration-test", "/review-test", "/narration-stats",
  "/excellence", "/excellence-comparison", "/student-quiz", "/quiz-results", "/quiz-comparison",
  "/levels", "/student-annual-plan", "/rankings",
];

export const useRole = () => {
  const { profile } = useAuth();
  const role = (profile?.role as StaffRole) || "teacher";
  const [halaqaType, setHalaqaType] = useState<"tahfeez" | "talqeen" | null>(null);

  // Detect whether the current teacher / assistant works in a Talqeen halaqa
  useEffect(() => {
    let cancelled = false;
    const detect = async () => {
      if (!profile?.id || (role !== "teacher" && role !== "assistant_teacher")) {
        setHalaqaType(null);
        return;
      }
      const { data } = await (supabase as any)
        .from("halaqat")
        .select("id, name, talqeen_curriculum_id")
        .or(`teacher_id.eq.${profile.id},assistant_teacher_id.eq.${profile.id}`)
        .eq("active", true)
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (data && (data.talqeen_curriculum_id || (data.name || "").includes("تلقين"))) {
        setHalaqaType("talqeen");
      } else if (data) {
        setHalaqaType("tahfeez");
      } else {
        setHalaqaType(null);
      }
    };
    detect();
    return () => { cancelled = true; };
  }, [profile?.id, role]);

  const isTalqeenIsolated = role === "assistant_teacher" && halaqaType === "talqeen";

  const baseAllowed =
    role === "custom_1775663809732"
      ? talqeenSupervisorRoutes
      : (rolePermissions[role] || rolePermissions.teacher);

  // For talqeen-isolated assistant teachers, hide academic memorization routes
  const allowedRoutes = isTalqeenIsolated
    ? baseAllowed.filter((r) => !talqeenIsolatedHidden.includes(r))
    : baseAllowed;

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
  const isTalqeenSupervisor = role === "custom_1775663809732";
  const isSupervisor =
    role === "supervisor" ||
    role === "assistant_supervisor" ||
    isTalqeenSupervisor;
  const isAdminStaff = role === "admin_staff" || role === "secretary";
  const isTeacher = role === "teacher" || role === "assistant_teacher";

  return {
    role,
    hasAccess,
    canWrite,
    allowedRoutes,
    isManager,
    isSupervisor,
    isTalqeenSupervisor,
    isAdminStaff,
    isTeacher,
    halaqaType,
    isTalqeenIsolated,
  };
};
