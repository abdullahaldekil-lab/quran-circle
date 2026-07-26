// The academy's programmes, in one place.
//
// Programme identity used to be hardcoded as three near-identical JSX blocks in
// ProgramsOverview, which is why the summer and talqeen programmes never appeared
// there. This registry is also what `program_materials.program_key` points at, so a
// material can be filed under the programme it belongs to.
//
// These are code-level concepts, not rows — there is no `programs` table (the only
// programme rows in the schema are `summer_programs`, which are *instances* of the
// summer programme, one per year).

export type ProgramKey = "excellence" | "madarij" | "narration" | "summer" | "talqeen";

export interface ProgramDef {
  key: ProgramKey;
  label: string;
  description: string;
  /** Route to the programme's own screen. Used for the "عرض التفاصيل" link and to
   *  hide programmes a role cannot open. */
  route: string;
  /** Tailwind classes for the card accent. */
  accent: string;
  border: string;
  icon: string;
}

export const PROGRAMS: ProgramDef[] = [
  {
    key: "excellence",
    label: "مسار التميّز",
    description: "متابعة الطلاب المتميزين وجلسات التميّز",
    route: "/excellence",
    accent: "text-amber-600",
    border: "border-amber-200 bg-amber-50/30 dark:bg-amber-950/10",
    icon: "Trophy",
  },
  {
    key: "madarij",
    label: "برنامج مدارج",
    description: "المسارات والمستويات واختبارات الأحزاب",
    route: "/madarij",
    accent: "text-emerald-600",
    border: "border-emerald-200 bg-emerald-50/30 dark:bg-emerald-950/10",
    icon: "BookOpen",
  },
  {
    key: "narration",
    label: "يوم السرد القرآني",
    description: "جلسات السرد ونتائجها",
    route: "/quran-narration",
    accent: "text-blue-600",
    border: "border-blue-200 bg-blue-50/30 dark:bg-blue-950/10",
    icon: "ScrollText",
  },
  {
    key: "summer",
    label: "البرنامج الصيفي (التعليمي)",
    description: "المقارئ وخطط الحفظ والإتقان والحضور",
    route: "/summer-programs",
    accent: "text-orange-600",
    border: "border-orange-200 bg-orange-50/30 dark:bg-orange-950/10",
    icon: "Sun",
  },
  {
    key: "talqeen",
    label: "برنامج التلقين",
    description: "حلقات التلقين ومناهجها وتنفيذ اليوم",
    route: "/talqeen-halaqat",
    accent: "text-purple-600",
    border: "border-purple-200 bg-purple-50/30 dark:bg-purple-950/10",
    icon: "GraduationCap",
  },
];

export const programByKey = (key: string | null | undefined): ProgramDef | undefined =>
  PROGRAMS.find((p) => p.key === key);

export const programLabel = (key: string | null | undefined): string =>
  programByKey(key)?.label ?? "غير مصنّف";
