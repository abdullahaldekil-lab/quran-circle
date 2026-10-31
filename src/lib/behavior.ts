/** فئات تقييم السلوك ونقاطها (موجبة للإيجابي وسالبة للسلبي). */
export const BEHAVIOR_CATEGORIES = [
  { key: "discipline", label: "انضباط واحترام", points: 5 },
  { key: "help", label: "تعاون ومساعدة الزملاء", points: 5 },
  { key: "manners", label: "حسن الخلق والأدب", points: 5 },
  { key: "cleanliness", label: "نظافة وترتيب", points: 3 },
  { key: "participation", label: "مشاركة متميزة", points: 3 },
  { key: "noise", label: "إزعاج أثناء الحلقة", points: -3 },
  { key: "disrespect", label: "عدم احترام", points: -5 },
  { key: "phone", label: "استخدام الجوال", points: -3 },
  { key: "fight", label: "مشاجرة", points: -10 },
] as const;

export const sumBehaviorPoints = (entries: { points: number }[]) => entries.reduce((t, e) => t + (Number(e.points) || 0), 0);
