import { supabase } from "@/integrations/supabase/client";

/**
 * Database-level views for separating Tahfeez vs Talqeen halaqat.
 * The DB views (halaqat_tahfeez / halaqat_talqeen_only) handle filtering with security_invoker
 * so RLS on the base `halaqat` table is fully respected.
 *
 * Use these helpers everywhere instead of querying `halaqat` directly when you need
 * a Tahfeez-only or Talqeen-only list.
 */

export const TAHFEEZ_VIEW = "halaqat_tahfeez";
export const TALQEEN_VIEW = "halaqat_talqeen_only";

/** Query builder for Tahfeez halaqat only (DB-level filter via view). */
export const halaqatTahfeez = () => (supabase as any).from(TAHFEEZ_VIEW);

/** Query builder for Talqeen halaqat only (DB-level filter via view). */
export const halaqatTalqeen = () => (supabase as any).from(TALQEEN_VIEW);

/**
 * Fallback client-side filter — kept for cases where data is fetched via joins on the
 * base `halaqat` table (e.g. `students(halaqat(name))`) and we cannot swap in the view.
 */
export const isTalqeenHalaqa = (h: any): boolean => {
  if (!h) return false;
  if (h.talqeen_curriculum_id) return true;
  const name = (h.name || "") as string;
  return name.includes("تلقين");
};

export const filterTahfeezOnly = <T extends { talqeen_curriculum_id?: any; name?: string | null }>(
  list: T[] | null | undefined
): T[] => (list || []).filter((h) => !isTalqeenHalaqa(h));

export const filterTalqeenOnly = <T extends { talqeen_curriculum_id?: any; name?: string | null }>(
  list: T[] | null | undefined
): T[] => (list || []).filter((h) => isTalqeenHalaqa(h));

/**
 * Halaqat a *new* student may be enrolled into. Talqeen halaqat are excluded:
 * enrolment there goes through the Talqeen module, never through student intake
 * (التسجيل المسبق / طلبات الالتحاق / إضافة طالب / الإضافة الجماعية).
 *
 * Use this for the halaqa picker on any student-creation form. Do NOT use it for
 * read-only filters — staff still need to filter and report on talqeen halaqat.
 */
export const assignableForNewStudent = filterTahfeezOnly;

/** Minimal shape needed to tell a talqeen halaqa from a tahfeez one. */
export interface HalaqaTypeFields {
  talqeen_curriculum_id?: string | null;
  name?: string | null;
}

/** Guard for a single halaqa on a student-creation path. */
export const canEnrolNewStudent = (h: HalaqaTypeFields | null | undefined): boolean =>
  !isTalqeenHalaqa(h);

/** Message shown when a new student is aimed at a talqeen halaqa. */
export const TALQEEN_ENROLMENT_BLOCKED_MSG =
  "لا يمكن إسناد طالب جديد إلى حلقة تلقين — التسجيل في التلقين يتم من قسم التلقين";
