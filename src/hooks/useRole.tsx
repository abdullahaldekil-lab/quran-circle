import { useAuth } from "@/hooks/useAuth";

export type StaffRole = 
  | "manager"
  | "secretary"
  | "supervisor"
  | "assistant_supervisor"
  | "admin_staff"
  | "teacher"
  | "assistant_teacher";

// Permission matrix per role
const rolePermissions: Record<StaffRole, string[]> = {
  manager: [
    "/dashboard", "/students", "/halaqat", "/recitation", "/attendance",
    "/instructions", "/levels", "/rankings", "/rewards", "/trips",
    "/finance", "/strategic-plan", "/kpi-dashboard", "/bulk-import",
    "/user-management", "/profile",
  ],
  supervisor: [
    "/dashboard", "/students", "/halaqat", "/recitation", "/attendance",
    "/instructions", "/levels", "/rankings", "/rewards", "/trips",
    "/strategic-plan", "/kpi-dashboard", "/profile",
  ],
  assistant_supervisor: [
    "/dashboard", "/students", "/halaqat", "/recitation", "/attendance",
    "/instructions", "/levels", "/rankings", "/rewards", "/trips",
    "/strategic-plan", "/kpi-dashboard", "/profile",
  ],
  secretary: [
    "/dashboard", "/students", "/halaqat", "/attendance", "/trips",
    "/finance", "/bulk-import", "/profile",
  ],
  admin_staff: [
    "/dashboard", "/students", "/halaqat", "/attendance", "/trips",
    "/finance", "/bulk-import", "/profile",
  ],
  teacher: [
    "/dashboard", "/students", "/halaqat", "/recitation", "/attendance",
    "/instructions", "/levels", "/rankings", "/rewards", "/trips", "/profile",
  ],
  assistant_teacher: [
    "/dashboard", "/students", "/halaqat", "/recitation", "/attendance",
    "/rankings", "/profile",
  ],
};

export const useRole = () => {
  const { profile } = useAuth();
  const role = (profile?.role as StaffRole) || "teacher";

  const allowedRoutes = rolePermissions[role] || rolePermissions.teacher;

  const hasAccess = (path: string) => {
    // Check exact match or prefix match for dynamic routes like /students/:id
    return allowedRoutes.some(
      (route) => path === route || path.startsWith(route + "/")
    );
  };

  const isManager = role === "manager";
  const isSupervisor = role === "supervisor" || role === "assistant_supervisor";
  const isAdminStaff = role === "admin_staff" || role === "secretary";
  const isTeacher = role === "teacher" || role === "assistant_teacher";

  return {
    role,
    hasAccess,
    allowedRoutes,
    isManager,
    isSupervisor,
    isAdminStaff,
    isTeacher,
  };
};
