import { describe, it, expect } from "vitest";
import {
  WORK_TABS,
  WORK_TAB_LABELS,
  combinedBadgeCount,
  combinedBadgeTitle,
  resolveInitialTab,
} from "./workHub";

describe("work tabs", () => {
  it("labels every tab", () => {
    WORK_TABS.forEach((t) => expect(WORK_TAB_LABELS[t].trim()).not.toBe(""));
  });
});

describe("resolveInitialTab", () => {
  it("prefers the query string", () => {
    expect(resolveInitialTab("?tab=requests", { tab: "tasks" })).toBe("requests");
  });

  it("falls back to router state when there is no query", () => {
    expect(resolveInitialTab("", { tab: "analytics" })).toBe("analytics");
  });

  it("falls back to the default when neither is set", () => {
    expect(resolveInitialTab("", null)).toBe("tasks");
    expect(resolveInitialTab(null, undefined, "requests")).toBe("requests");
  });

  it("ignores an unknown tab value", () => {
    expect(resolveInitialTab("?tab=nope", null)).toBe("tasks");
    expect(resolveInitialTab("", { tab: 42 })).toBe("tasks");
  });

  it("accepts URLSearchParams directly", () => {
    expect(resolveInitialTab(new URLSearchParams({ tab: "requests" }), null)).toBe("requests");
  });
});

describe("combinedBadgeCount", () => {
  it("adds both counts", () => {
    expect(combinedBadgeCount(3, 2)).toBe(5);
  });

  it("treats missing or negative counts as zero", () => {
    expect(combinedBadgeCount(null, undefined)).toBe(0);
    expect(combinedBadgeCount(-4, 2)).toBe(2);
  });
});

describe("combinedBadgeTitle", () => {
  it("breaks the badge down", () => {
    expect(combinedBadgeTitle(3, 2)).toBe("2 مهمة عاجلة · 3 طلب معلّق");
  });

  it("omits an empty side", () => {
    expect(combinedBadgeTitle(0, 2)).toBe("2 مهمة عاجلة");
    expect(combinedBadgeTitle(3, 0)).toBe("3 طلب معلّق");
    expect(combinedBadgeTitle(0, 0)).toBe("");
  });
});
