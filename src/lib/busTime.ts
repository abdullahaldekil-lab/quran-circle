/** وقت بنظام 12 ساعة (ص/م). */
export const formatTime12 = (iso: string) => {
  const d = new Date(iso);
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, "0");
  const ap = h >= 12 ? "م" : "ص";
  h = h % 12 || 12;
  return `${h}:${m} ${ap}`;
};
