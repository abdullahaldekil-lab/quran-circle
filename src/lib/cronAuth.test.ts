import { describe, expect, it, vi } from "vitest";
import { authorizeCronCall } from "../../supabase/functions/_shared/cron-auth";

const request = (headers: Record<string, string> = {}) =>
  new Request("https://example.invalid/scheduled-job", { headers });

describe("scheduled job authorization", () => {
  it("rejects anonymous callers when the cron secret is missing", async () => {
    const verify = vi.fn();
    expect(await authorizeCronCall(request(), { isActiveManager: verify })).toBe(false);
    expect(verify).not.toHaveBeenCalled();
  });

  it("accepts the configured cron secret without a user session", async () => {
    const verify = vi.fn();
    expect(await authorizeCronCall(request({ "x-cron-secret": "scheduled-secret" }), {
      expectedSecret: "scheduled-secret", isActiveManager: verify,
    })).toBe(true);
    expect(verify).not.toHaveBeenCalled();
  });

  it("does not accept an empty secret header as configured authorization", async () => {
    expect(await authorizeCronCall(request({ "x-cron-secret": "" }), {
      expectedSecret: "", isActiveManager: vi.fn(),
    })).toBe(false);
  });

  it("rejects incorrect secrets", async () => {
    expect(await authorizeCronCall(request({ "x-cron-secret": "wrong" }), {
      expectedSecret: "scheduled-secret", isActiveManager: vi.fn(),
    })).toBe(false);
  });

  it("rejects a fabricated bearer token rather than trusting its prefix", async () => {
    const verify = vi.fn().mockResolvedValue(false);
    expect(await authorizeCronCall(request({ Authorization: "Bearer fake-token" }), {
      expectedSecret: "scheduled-secret", isActiveManager: verify,
    })).toBe(false);
    expect(verify).toHaveBeenCalledWith("fake-token");
  });

  it("allows a verified active manager to run a job manually", async () => {
    expect(await authorizeCronCall(request({ Authorization: "Bearer manager-token" }), {
      isActiveManager: vi.fn().mockResolvedValue(true),
    })).toBe(true);
  });

  it("fails closed if identity verification is unavailable", async () => {
    expect(await authorizeCronCall(request({ Authorization: "Bearer token" }), {
      isActiveManager: vi.fn().mockRejectedValue(new Error("authentication unavailable")),
    })).toBe(false);
  });

  it("rejects an empty bearer token", async () => {
    const verify = vi.fn();
    expect(await authorizeCronCall(request({ Authorization: "Bearer " }), {
      isActiveManager: verify,
    })).toBe(false);
    expect(verify).not.toHaveBeenCalled();
  });

  it("accepts the exact managed schedule credential as bearer", async () => {
    const verify = vi.fn();
    expect(await authorizeCronCall(request({ Authorization: "Bearer managed-secret" }), {
      managedSecret: "managed-secret", isActiveManager: verify,
    })).toBe(true);
    expect(verify).not.toHaveBeenCalled();
  });

  it("rejects a wrong bearer when a managed credential is configured", async () => {
    expect(await authorizeCronCall(request({ Authorization: "Bearer managed-secretX" }), {
      managedSecret: "managed-secret", isActiveManager: vi.fn().mockResolvedValue(false),
    })).toBe(false);
  });

  it("does not treat an empty managed credential as configured", async () => {
    expect(await authorizeCronCall(request({ Authorization: "Bearer x" }), {
      managedSecret: "", isActiveManager: vi.fn().mockResolvedValue(false),
    })).toBe(false);
  });
});
