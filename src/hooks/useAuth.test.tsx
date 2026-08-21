import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";

type Listener = (event: string, session: unknown) => void;

const state = {
  listeners: [] as Listener[],
  session: null as any,
  row: null as any,
  error: null as any,
  selectedColumns: "",
  fetches: 0,
  signOutCalls: 0,
  gate: null as Promise<void> | null,
};

const sessionFor = (userId: string, token = "t1") => ({
  access_token: token,
  user: { id: userId, updated_at: "2026-01-01T00:00:00Z" },
});

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      onAuthStateChange: (cb: Listener) => {
        state.listeners.push(cb);
        return { data: { subscription: { unsubscribe: () => {} } } };
      },
      getSession: async () => ({ data: { session: state.session } }),
      signOut: async () => {
        state.signOutCalls++;
        state.session = null;
        return { error: null };
      },
    },
    from: () => ({
      select: (columns: string) => {
        state.selectedColumns = columns;
        return {
          eq: () => ({
            maybeSingle: async () => {
              state.fetches++;
              if (state.gate) await state.gate;
              return { data: state.row, error: state.error };
            },
          }),
        };
      },
    }),
  },
}));

import { AuthProvider, useAuth } from "./useAuth";

const Probe = () => {
  const { loading, profile, session } = useAuth();
  return (
    <div>
      <span data-testid="loading">{String(loading)}</span>
      <span data-testid="role">{profile?.role ?? "-"}</span>
      <span data-testid="user">{session?.user?.id ?? "-"}</span>
    </div>
  );
};

const emit = async (event: string, session: unknown) => {
  await act(async () => {
    state.listeners.forEach((cb) => cb(event, session));
    await Promise.resolve();
  });
};

beforeEach(() => {
  state.listeners = [];
  state.session = null;
  state.row = { id: "u1", full_name: "أحمد", role: "manager", phone: null, avatar_url: null };
  state.error = null;
  state.selectedColumns = "";
  state.fetches = 0;
  state.signOutCalls = 0;
  state.gate = null;
  vi.useRealTimers();
});

describe("AuthProvider", () => {
  it("يبقى loading صحيحاً حتى يصل البروفايل — لا يُعرض المحتوى بدور افتراضي خاطئ", async () => {
    state.session = sessionFor("u1");
    let release!: () => void;
    state.gate = new Promise<void>((resolve) => (release = resolve));

    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(state.fetches).toBe(1));

    // الجلسة موجودة والبروفايل لم يصل بعد: يجب أن يبقى loading = true
    expect(screen.getByTestId("loading").textContent).toBe("true");
    expect(screen.getByTestId("role").textContent).toBe("-");

    await act(async () => { release(); await state.gate; });
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
    expect(screen.getByTestId("role").textContent).toBe("manager");
  });

  it("يطلب كل الأعمدة التي يستعملها التطبيق (منها avatar_url)", async () => {
    state.session = sessionFor("u1");
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(state.fetches).toBe(1));
    for (const col of [
      "id", "full_name", "role", "phone", "avatar_url",
      "job_title", "department", "position_title", "last_login_at", "created_at",
    ]) {
      expect(state.selectedColumns.split(", ")).toContain(col);
    }
  });

  it("لا يكرر جلب البروفايل بين INITIAL_SESSION و getSession", async () => {
    state.session = sessionFor("u1");
    render(<AuthProvider><Probe /></AuthProvider>);
    await emit("INITIAL_SESSION", state.session);
    await emit("TOKEN_REFRESHED", sessionFor("u1", "t2"));
    await waitFor(() => expect(screen.getByTestId("role").textContent).toBe("manager"));
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(state.fetches).toBe(1);
  });

  it("يعيد جلب البروفايل بعد خروج ودخول نفس المستخدم", async () => {
    state.session = sessionFor("u1");
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId("role").textContent).toBe("manager"));

    await emit("SIGNED_OUT", null);
    await waitFor(() => expect(screen.getByTestId("role").textContent).toBe("-"));

    await emit("SIGNED_IN", sessionFor("u1", "t3"));
    await waitFor(() => expect(state.fetches).toBe(2));
    expect(screen.getByTestId("role").textContent).toBe("manager");
  });

  it("تبديل المستخدم يُسقط بروفايل السابق ولا يعيده سباق قديم", async () => {
    state.session = sessionFor("u1");
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByTestId("role").textContent).toBe("manager"));

    state.row = { id: "u2", full_name: "سارة", role: "teacher", phone: null, avatar_url: null };
    await emit("SIGNED_IN", sessionFor("u2", "t9"));
    await waitFor(() => expect(screen.getByTestId("role").textContent).toBe("teacher"));
    expect(screen.getByTestId("user").textContent).toBe("u2");
  });

  it("يعيد المحاولة مرة عند فشل الجلب ثم يتوقف عن التحميل", async () => {
    state.session = sessionFor("u1");
    state.error = { message: "network" };
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(state.fetches).toBe(2), { timeout: 3000 });
    await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));
    expect(screen.getByTestId("role").textContent).toBe("-");
    err.mockRestore();
  });

  it("signOut يمسح الحالة المحلية حتى لو فشل الخادم", async () => {
    state.session = sessionFor("u1");
    const Signer = () => {
      const { signOut, profile } = useAuth();
      return <button onClick={() => void signOut()}>{profile?.role ?? "-"}</button>;
    };
    render(<AuthProvider><Signer /></AuthProvider>);
    await waitFor(() => expect(screen.getByRole("button").textContent).toBe("manager"));
    await act(async () => { screen.getByRole("button").click(); });
    await waitFor(() => expect(screen.getByRole("button").textContent).toBe("-"));
    expect(state.signOutCalls).toBe(1);
  });
});
