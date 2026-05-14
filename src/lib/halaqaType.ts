/**
 * Helper to distinguish Tahfeez halaqat from Talqeen halaqat.
 * A halaqa is considered Talqeen if it has a talqeen_curriculum_id linked,
 * or its name contains "تلقين" (legacy halaqat created before curriculum link).
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
