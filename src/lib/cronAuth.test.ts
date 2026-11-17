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

  it("accepts an exact managed bearer credential without a manager lookup", async () => {
    const verify = vi.fn();
    expect(await authorizeCronCall(request({ Authorization: "Bearer managed-secret" }), {
      managedSecret: "managed-secret", isActiveManager: verify,
    })).toBe(true);
    expect(verify).not.toHaveBeenCalled();
  });

  it("does not accept a different bearer credential just because managed cron is configured", async () => {
    const verify = vi.fn().mockResolvedValue(false);
    expect(await authorizeCronCall(request({ Authorization: "Bearer wrong-secret" }), {
      managedSecret: "managed-secret", isActiveManager: verify,
    })).toBe(false);
    expect(verify).toHaveBeenCalledWith("wrong-secret");
  });

  it("fails closed when the managed secret is missing or empty", async () => {
    for (const managedSecret of [undefined, ""]) {
      expect(await authorizeCronCall(request({ Authorization: "Bearer arbitrary-token" }), {
        managedSecret, isActiveManager: vi.fn().mockResolvedValue(false),
      })).toBe(false);
    }
  });

  it("rejects anonymous requests even when managed cron is configured", async () => {
    const verify = vi.fn();
    expect(await authorizeCronCall(request(), {
      managedSecret: "managed-secret", isActiveManager: verify,
    })).toBe(false);
    expect(verify).not.toHaveBeenCalled();
  });

  it("does not treat a publishable API key as the managed credential", async () => {
    expect(await authorizeCronCall(request({
      Authorization: "Bearer sb_publishable_example", apikey: "sb_publishable_example",
    }), {
      managedSecret: "managed-secret", isActiveManager: vi.fn().mockResolvedValue(false),
    })).toBe(false);
  });

  it("retains the legacy secret-header path when a managed secret is also configured", async () => {
    expect(await authorizeCronCall(request({ "x-cron-secret": "legacy-secret" }), {
      expectedSecret: "legacy-secret", managedSecret: "managed-secret", isActiveManager: vi.fn(),
    })).toBe(true);
  });

  it("rejects a malformed managed bearer token", async () => {
    const verify = vi.fn();
    expect(await authorizeCronCall(request({ Authorization: "Bearer managed-secret extra" }), {
      managedSecret: "managed-secret", isActiveManager: verify,
    })).toBe(false);
    expect(verify).not.toHaveBeenCalled();
  });

  it("does not accept the managed secret through an unconfigured legacy header", async () => {
    expect(await authorizeCronCall(request({ "x-cron-secret": "managed-secret" }), {
      managedSecret: "managed-secret", isActiveManager: vi.fn(),
    })).toBe(false);
  });
});
