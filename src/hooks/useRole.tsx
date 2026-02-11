import { useAuth } from "@/hooks/useAuth";

export type StaffRole =
  | "manager"
  | "secretary"
  | "supervisor"
  | "assistant_supervisor"
  | "admin_staff"
  | "teacher"
  | "assistant_teacher";

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
    "/dashboard", "/students", "/halaqat", "/recitation", "/attendance",
    "/instructions", "/levels", "/rankings", "/rewards", "/trips",
    "/finance", "/strategic-plan", "/strategy", "/kpi-dashboard", "/bulk-import",
    "/user-management", "/profile", "/health", "/documents", "/buses", "/pre-registration", "/enrollment-requests", "/preparation", "/academic-calendar",
  ],
  supervisor: [
    "/dashboard", "/halaqat", "/recitation", "/kpi-dashboard",
    "/strategic-plan", "/strategy", "/profile", "/documents", "/pre-registration", "/enrollment-requests", "/preparation", "/academic-calendar",
  ],
  assistant_supervisor: [
    "/dashboard", "/halaqat", "/recitation", "/kpi-dashboard",
    "/strategic-plan", "/strategy", "/profile", "/documents", "/pre-registration", "/enrollment-requests", "/preparation", "/academic-calendar",
  ],
  secretary: [
    "/dashboard", "/students", "/halaqat", "/attendance",
    "/bulk-import", "/trips", "/profile", "/buses", "/pre-registration", "/enrollment-requests", "/preparation", "/academic-calendar",
  ],
  admin_staff: [
    "/dashboard", "/students", "/halaqat", "/attendance",
    "/bulk-import", "/trips", "/profile", "/buses", "/pre-registration", "/enrollment-requests", "/preparation", "/academic-calendar",
  ],
  teacher: [
    "/dashboard", "/students", "/halaqat", "/recitation", "/attendance",
    "/rankings", "/trips", "/profile", "/buses", "/preparation", "/academic-calendar",
  ],
  assistant_teacher: [
    "/dashboard", "/students", "/halaqat", "/recitation", "/attendance",
    "/rankings", "/profile", "/preparation", "/academic-calendar",
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
};

export const useRole = () => {
  const { profile } = useAuth();
  const role = (profile?.role as StaffRole) || "teacher";

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
