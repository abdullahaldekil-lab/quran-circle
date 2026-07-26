import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { PROGRAMS, programByKey, programLabel } from "./programs";

// useRole reads the signed-in profile and probes halaqat; pin both so the route matrix
// is deterministic.
const authState = { profile: { id: "u1", role: "manager" } };
vi.mock("@/hooks/useAuth", () => ({ useAuth: () => authState }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        or: () => ({ eq: () => ({ limit: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
      }),
    }),
  },
}));

import { useRole } from "@/hooks/useRole";

describe("PROGRAMS registry", () => {
  it("has unique keys", () => {
    const keys = PROGRAMS.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("gives every programme a label, description and route", () => {
    PROGRAMS.forEach((p) => {
      expect(p.label.trim()).not.toBe("");
      expect(p.description.trim()).not.toBe("");
      expect(p.route.startsWith("/")).toBe(true);
    });
  });

  it("looks a programme up by key and falls back for an unknown one", () => {
    expect(programByKey("summer")?.label).toBe("البرنامج الصيفي (التعليمي)");
    expect(programByKey("nope")).toBeUndefined();
    expect(programLabel(null)).toBe("غير مصنّف");
  });

  it("routes every programme to a path the manager can reach", () => {
    // Route access is a hardcoded array in useRole.tsx, so a programme added to this
    // registry without a matching ACL entry would silently render "غير مصرّح".
    const { result } = renderHook(() => useRole());
    PROGRAMS.forEach((p) => {
      expect(result.current.hasAccess(p.route), `${p.key} → ${p.route}`).toBe(true);
    });
  });
});
