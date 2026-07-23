// End-to-end test for the recitation input flow → DB save with permission enforcement.
// Mocks a Supabase-shaped client that simulates RLS on public.recitation_records:
//   INSERT allowed only when payload.teacher_id === authenticated user id AND the
//   teacher is assigned to the target halaqa (matches the app's RLS policies).

import { describe, it, expect } from "vitest";
import { saveRecitationRecord, buildRecitationRecordPayload } from "./recitation-save";
import { emptyBreakdown } from "./recitation-scoring";

type Row = Record<string, any>;

interface FakeAuth {
  uid: string | null;
  role: "teacher" | "manager" | "anon";
  // halaqas this user is allowed to write for (teacher case).
  allowedHalaqas: string[];
}

const makeDb = (auth: FakeAuth, store: { recitation_records: Row[] }) => ({
  from(table: string) {
    return {
      async insert(row: Row) {
        if (table !== "recitation_records") {
          return { error: { message: "unknown table", code: "42P01" } };
        }
        // Simulated RLS: anon blocked outright.
        if (auth.role === "anon" || !auth.uid) {
          return { error: { message: "row-level security violation", code: "42501" } };
        }
        // Managers may insert anything.
        if (auth.role === "manager") {
          store.recitation_records.push(row);
          return { error: null };
        }
        // Teachers: teacher_id must equal auth.uid AND halaqa must be assigned.
        if (row.teacher_id !== auth.uid) {
          return { error: { message: "teacher_id mismatch (RLS)", code: "42501" } };
        }
        if (!auth.allowedHalaqas.includes(row.halaqa_id)) {
          return { error: { message: "halaqa not assigned (RLS)", code: "42501" } };
        }
        store.recitation_records.push(row);
        return { error: null };
      },
    };
  },
});

const baseForm = () => ({
  memorized_from: "البقرة 1",
  memorized_to: "البقرة 5",
  review_from: "",
  review_to: "",
  linking_from: "",
  linking_to: "",
  mistakes_breakdown: {
    ...emptyBreakdown(),
    memorization: { error: 2, lahn: 1, warning: 3 }, // 100 - 10 - 2 - 3 = 85
  },
  notes: "ممتاز",
});

describe("recitation save E2E", () => {
  it("builds the correct DB payload from the UI form", () => {
    const payload = buildRecitationRecordPayload({
      studentId: "s1",
      halaqaId: "h1",
      teacherId: "t1",
      form: baseForm(),
      audioUrl: "https://x/a.webm",
    });
    expect(payload).toMatchObject({
      student_id: "s1",
      halaqa_id: "h1",
      teacher_id: "t1",
      memorized_from: "البقرة 1",
      memorized_to: "البقرة 5",
      review_from: null,
      linking_from: null,
      mistakes_count: 6,
      total_score: 85,
      notes: "ممتاز",
      audio_url: "https://x/a.webm",
    });
  });

  it("teacher assigned to halaqa: insert succeeds and row is persisted", async () => {
    const store = { recitation_records: [] as Row[] };
    const db = makeDb(
      { uid: "teacher-1", role: "teacher", allowedHalaqas: ["h1"] },
      store,
    );
    const result = await saveRecitationRecord(db, {
      studentId: "s1",
      halaqaId: "h1",
      teacherId: "teacher-1",
      form: baseForm(),
    });
    expect(result.ok).toBe(true);
    expect(result.totalScore).toBe(85);
    expect(store.recitation_records).toHaveLength(1);
    expect(store.recitation_records[0].teacher_id).toBe("teacher-1");
    expect(store.recitation_records[0].halaqa_id).toBe("h1");
  });

  it("teacher spoofing another teacher_id is rejected by RLS", async () => {
    const store = { recitation_records: [] as Row[] };
    const db = makeDb(
      { uid: "teacher-1", role: "teacher", allowedHalaqas: ["h1"] },
      store,
    );
    // Simulate a malicious caller passing a different teacher_id.
    // saveRecitationRecord forwards teacherId as-is; RLS must reject it.
    const result = await saveRecitationRecord(db, {
      studentId: "s1",
      halaqaId: "h1",
      teacherId: "other-teacher",
      form: baseForm(),
    });
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("42501");
    expect(store.recitation_records).toHaveLength(0);
  });

  it("teacher writing to an unassigned halaqa is rejected", async () => {
    const store = { recitation_records: [] as Row[] };
    const db = makeDb(
      { uid: "teacher-1", role: "teacher", allowedHalaqas: ["h1"] },
      store,
    );
    const result = await saveRecitationRecord(db, {
      studentId: "s1",
      halaqaId: "h-foreign",
      teacherId: "teacher-1",
      form: baseForm(),
    });
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("42501");
    expect(store.recitation_records).toHaveLength(0);
  });

  it("anonymous save is blocked before hitting the DB", async () => {
    const store = { recitation_records: [] as Row[] };
    const db = makeDb({ uid: null, role: "anon", allowedHalaqas: [] }, store);
    const result = await saveRecitationRecord(db, {
      studentId: "s1",
      halaqaId: "h1",
      teacherId: null,
      form: baseForm(),
    });
    expect(result.ok).toBe(false);
    expect(result.error?.message).toBe("unauthenticated");
    expect(store.recitation_records).toHaveLength(0);
  });

  it("manager can save on behalf of any halaqa", async () => {
    const store = { recitation_records: [] as Row[] };
    const db = makeDb({ uid: "mgr", role: "manager", allowedHalaqas: [] }, store);
    const result = await saveRecitationRecord(db, {
      studentId: "s1",
      halaqaId: "any-halaqa",
      teacherId: "mgr",
      form: baseForm(),
    });
    expect(result.ok).toBe(true);
    expect(store.recitation_records).toHaveLength(1);
  });

  it("empty ranges are normalized to null (not empty strings) in the payload", async () => {
    const store = { recitation_records: [] as Row[] };
    const db = makeDb(
      { uid: "t", role: "teacher", allowedHalaqas: ["h"] },
      store,
    );
    const form = baseForm();
    form.memorized_from = "";
    form.memorized_to = "";
    await saveRecitationRecord(db, {
      studentId: "s",
      halaqaId: "h",
      teacherId: "t",
      form,
    });
    const saved = store.recitation_records[0];
    expect(saved.memorized_from).toBeNull();
    expect(saved.memorized_to).toBeNull();
    expect(saved.notes).toBe("ممتاز");
  });

  it("perfect recitation (no mistakes) yields score 100", async () => {
    const store = { recitation_records: [] as Row[] };
    const db = makeDb(
      { uid: "t", role: "teacher", allowedHalaqas: ["h"] },
      store,
    );
    const result = await saveRecitationRecord(db, {
      studentId: "s",
      halaqaId: "h",
      teacherId: "t",
      form: { ...baseForm(), mistakes_breakdown: emptyBreakdown() },
    });
    expect(result.ok).toBe(true);
    expect(result.totalScore).toBe(100);
    expect(store.recitation_records[0].mistakes_count).toBe(0);
  });
});
