import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import StudentAnnualPlanCard from "./StudentAnnualPlanCard";

const fixture = vi.hoisted(() => ({
  plan: { id: "plan", status: "active", term: "annual", start_date: "2000-01-01", end_date: "2100-01-01", daily_memorization_pages: 2, daily_review_pages: 1, daily_linking_pages: 0 },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from(table: string) {
      const data = table === "student_annual_plans"
        ? [fixture.plan]
        : [{ memorized_to: "صفحة 42 (الجزء 3)", review_to: "صفحة 41 (الجزء 2)" }];
      const query = {
        select: () => query,
        eq: () => query,
        order: () => query,
        limit: () => query,
        then: (resolve: (value: { data: unknown }) => unknown) => Promise.resolve({ data }).then(resolve),
      };
      return query;
    },
  },
}));
vi.mock("@/components/mushaf/MushafViewer", () => ({ default: () => null }));

beforeEach(() => {
  fixture.plan.daily_memorization_pages = 2;
  fixture.plan.daily_review_pages = 1;
});
afterEach(cleanup);

describe("annual plan recitation suggestions", () => {
  it("applies two full pages for two faces, and includes the last memorized page in review", async () => {
    const apply = vi.fn();
    render(<StudentAnnualPlanCard studentId="student" onApply={apply} />);
    await waitFor(() => expect(apply).toHaveBeenCalled());
    expect(apply.mock.calls[0][0]).toMatchObject({
      memorized_from: "صفحة 43 (الجزء 3)",
      memorized_to: "صفحة 44 (الجزء 3)",
      review_from: "صفحة 42 (الجزء 3)",
      review_to: "صفحة 42 (الجزء 3)",
    });
  });

  it("does not save a half-face target as a full-page suggestion", async () => {
    fixture.plan.daily_memorization_pages = 0.5;
    const apply = vi.fn();
    render(<StudentAnnualPlanCard studentId="student" onApply={apply} />);
    await screen.findByText(/المقدار يتضمن جزءًا من وجه/);
    expect(screen.getByRole("button", { name: "تطبيق" })).toBeDisabled();
    expect(apply).not.toHaveBeenCalled();
  });

  it("requires precise endpoints when the review target is fractional", async () => {
    fixture.plan.daily_review_pages = 0.5;
    const apply = vi.fn();
    render(<StudentAnnualPlanCard studentId="student" onApply={apply} />);
    await screen.findByText(/المقدار يتضمن جزءًا من وجه/);
    expect(apply).not.toHaveBeenCalled();
  });
});
