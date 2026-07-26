import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";

// Mock useAuth so useRole is deterministic across roles.
const authState: { profile: { id: string; role: string } | null } = {
  profile: { id: "u1", role: "teacher" },
};
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => authState,
}));

// Mock supabase client — useRole probes halaqat for teachers to detect talqeen isolation.
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        or: () => ({
          eq: () => ({
            limit: () => ({
              maybeSingle: async () => ({ data: null, error: null }),
            }),
          }),
        }),
      }),
    }),
  },
}));

import { useRole } from "./useRole";

const withRole = (role: string) => {
  authState.profile = { id: "u1", role };
  return renderHook(() => useRole()).result.current;
};

describe("useRole route access matrix", () => {
  it("manager can reach every sensitive area", () => {
    const { hasAccess } = withRole("manager");
    for (const p of [
      "/user-management",
      "/permissions-management",
      "/finance",
      "/nazem-export",
      "/strategic-plan",
    ]) {
      expect(hasAccess(p)).toBe(true);
    }
  });

  it("teacher is limited to teaching flows and blocked from admin", () => {
    const { hasAccess } = withRole("teacher");
    expect(hasAccess("/recitation")).toBe(true);
    expect(hasAccess("/attendance")).toBe(true);
    expect(hasAccess("/user-management")).toBe(false);
    expect(hasAccess("/finance")).toBe(false);
    expect(hasAccess("/nazem-export")).toBe(false);
    expect(hasAccess("/permissions-management")).toBe(false);
  });

  it("secretary handles registrations but cannot open academic pages", () => {
    const { hasAccess } = withRole("secretary");
    expect(hasAccess("/students")).toBe(true);
    expect(hasAccess("/enrollment-requests")).toBe(true);
    expect(hasAccess("/recitation")).toBe(false);
    expect(hasAccess("/finance")).toBe(false);
    expect(hasAccess("/nazem-export")).toBe(false);
  });

  it("supervisor keeps academic access and nazem-export but not user management", () => {
    const { hasAccess } = withRole("supervisor");
    expect(hasAccess("/recitation")).toBe(true);
    expect(hasAccess("/nazem-export")).toBe(true);
    expect(hasAccess("/user-management")).toBe(false);
    expect(hasAccess("/finance")).toBe(false);
  });

  it("talqeen supervisor custom role reaches talqeen suite and student data", () => {
    const { hasAccess } = withRole("custom_1775663809732");
    expect(hasAccess("/talqeen-supervisor")).toBe(true);
    expect(hasAccess("/talqeen-halaqat")).toBe(true);
    expect(hasAccess("/students")).toBe(true);
    expect(hasAccess("/attendance")).toBe(true);
    expect(hasAccess("/finance")).toBe(false);
    expect(hasAccess("/user-management")).toBe(false);
  });

  it("unknown role falls back to teacher permissions", () => {
    const { hasAccess } = withRole("some_new_role_never_seen");
    expect(hasAccess("/recitation")).toBe(true);
    expect(hasAccess("/user-management")).toBe(false);
  });

  it("canWrite enforces resource-level rules", () => {
    expect(withRole("teacher").canWrite("recitation")).toBe(true);
    expect(withRole("teacher").canWrite("finance")).toBe(false);
    expect(withRole("secretary").canWrite("students")).toBe(true);
    expect(withRole("secretary").canWrite("recitation")).toBe(false);
    expect(withRole("manager").canWrite("finance")).toBe(true);
  });

  it("hasAccess matches sub-routes via prefix", () => {
    const { hasAccess } = withRole("manager");
    expect(hasAccess("/students/abc-123")).toBe(true);
    expect(hasAccess("/admin/guardian-messages")).toBe(true);
  });

  it("every role that could open tasks or requests can open the merged work hub", () => {
    // /staff-tasks and /internal-requests now redirect to /work-hub. A role missing
    // the new entry would be bounced to "غير مصرّح" instead of the page it had before.
    for (const role of [
      "manager",
      "supervisor",
      "assistant_supervisor",
      "secretary",
      "admin_staff",
      "teacher",
      "assistant_teacher",
      "custom_1775663809732", // مشرف التلقين
    ]) {
      const { hasAccess } = withRole(role);
      if (hasAccess("/staff-tasks") || hasAccess("/internal-requests")) {
        expect(hasAccess("/work-hub"), `${role} → /work-hub`).toBe(true);
      }
    }
  });

  it("keeps the old task and request routes reachable so their redirects run", () => {
    const { hasAccess } = withRole("teacher");
    expect(hasAccess("/staff-tasks")).toBe(true);
    expect(hasAccess("/internal-requests")).toBe(true);
    expect(hasAccess("/work-hub")).toBe(true);
  });
});
