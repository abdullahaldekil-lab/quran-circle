import { describe, it, expect } from "vitest";
import {
  isTalqeenHalaqa,
  filterTahfeezOnly,
  filterTalqeenOnly,
  assignableForNewStudent,
  canEnrolNewStudent,
} from "./halaqaType";

const tahfeez = { id: "h1", name: "حلقة النور", talqeen_curriculum_id: null };
const talqeenByCurriculum = { id: "h2", name: "حلقة الفجر", talqeen_curriculum_id: "c1" };
const talqeenByName = { id: "h3", name: "حلقة تلقين الصغار", talqeen_curriculum_id: null };

describe("isTalqeenHalaqa", () => {
  it("treats an assigned talqeen curriculum as the primary signal", () => {
    expect(isTalqeenHalaqa(talqeenByCurriculum)).toBe(true);
  });

  it("falls back to the Arabic name when no curriculum is linked yet", () => {
    expect(isTalqeenHalaqa(talqeenByName)).toBe(true);
  });

  it("treats a plain memorization halaqa as tahfeez", () => {
    expect(isTalqeenHalaqa(tahfeez)).toBe(false);
  });

  it("is safe on null/undefined", () => {
    expect(isTalqeenHalaqa(null)).toBe(false);
    expect(isTalqeenHalaqa(undefined)).toBe(false);
  });

  it("does not crash on a halaqa with no name", () => {
    expect(isTalqeenHalaqa({ id: "h4" })).toBe(false);
  });
});

describe("filterTahfeezOnly / filterTalqeenOnly", () => {
  const all = [tahfeez, talqeenByCurriculum, talqeenByName];

  it("partitions the list without overlap", () => {
    const tah = filterTahfeezOnly(all);
    const tal = filterTalqeenOnly(all);
    expect(tah.map((h) => h.id)).toEqual(["h1"]);
    expect(tal.map((h) => h.id)).toEqual(["h2", "h3"]);
    expect(tah.length + tal.length).toBe(all.length);
  });

  it("tolerates null and undefined input", () => {
    expect(filterTahfeezOnly(null)).toEqual([]);
    expect(filterTalqeenOnly(undefined)).toEqual([]);
  });
});

describe("new-student enrolment guard", () => {
  it("offers only tahfeez halaqat to a new student", () => {
    expect(assignableForNewStudent([tahfeez, talqeenByCurriculum]).map((h) => h.id)).toEqual(["h1"]);
  });

  it("rejects a talqeen halaqa for a new student", () => {
    expect(canEnrolNewStudent(talqeenByCurriculum)).toBe(false);
    expect(canEnrolNewStudent(talqeenByName)).toBe(false);
  });

  it("accepts a tahfeez halaqa for a new student", () => {
    expect(canEnrolNewStudent(tahfeez)).toBe(true);
  });
});
