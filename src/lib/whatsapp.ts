/**
 * أدوات مشتركة لفتح محادثة واتساب جاهزة (wa.me) بأرقام أولياء الأمور.
 *
 * لا يوجد إرسال آلي هنا: واتساب يشترط نقرة المستخدم، لذلك نبني رابط محادثة
 * بنص جاهز ونفتحه في تبويب جديد.
 */

/** يطبّع رقم سعودي/دولي إلى الصيغة التي يقبلها wa.me (أرقام فقط بمقدمة الدولة). */
export const normalizeWhatsappNumber = (raw?: string | null): string | null => {
  if (!raw) return null;
  // الأرقام العربية الهندية إلى لاتينية
  const latin = raw.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  let digits = latin.replace(/\D/g, "");
  if (!digits) return null;

  // 00966xxxxxxxxx -> 966xxxxxxxxx
  if (digits.startsWith("00")) digits = digits.slice(2);

  if (digits.startsWith("966")) {
    const local = digits.slice(3).replace(/^0+/, "");
    return local.length === 9 ? `966${local}` : null;
  }

  // أرقام محلية: 05xxxxxxxx أو 5xxxxxxxx
  const local = digits.replace(/^0+/, "");
  if (local.length === 9 && local.startsWith("5")) return `966${local}`;

  // رقم دولي آخر (غير سعودي) — نقبله كما هو إذا كان بطول منطقي
  if (digits.length >= 10 && digits.length <= 15) return digits;

  return null;
};

/** يستبدل المتغيرات العربية داخل نص الرسالة: {اسم_الطالب} ... */
export const applyMessageVars = (
  template: string,
  vars: Record<string, string | null | undefined>,
): string => {
  let out = template || "";
  for (const [key, value] of Object.entries(vars)) {
    out = out.split(`{${key}}`).join(value ?? "");
  }
  return out;
};

/** يبني رابط محادثة واتساب، أو null إذا كان الرقم غير صالح. */
export const buildWhatsappLink = (phone?: string | null, message?: string): string | null => {
  const number = normalizeWhatsappNumber(phone);
  if (!number) return null;
  const text = (message || "").trim();
  return text
    ? `https://wa.me/${number}?text=${encodeURIComponent(text)}`
    : `https://wa.me/${number}`;
};

/** يختار رقم ولي الأمر: ملف ولي الأمر أولًا ثم بيانات الطالب. */
export const resolveGuardianPhone = (
  guardianProfilePhone?: string | null,
  studentGuardianPhone?: string | null,
): string | null =>
  normalizeWhatsappNumber(guardianProfilePhone) || normalizeWhatsappNumber(studentGuardianPhone);

/** يفتح المحادثة في تبويب جديد. يعيد false إذا لم يكن هناك رقم صالح. */
export const openWhatsapp = (phone?: string | null, message?: string): boolean => {
  const link = buildWhatsappLink(phone, message);
  if (!link) return false;
  window.open(link, "_blank", "noopener,noreferrer");
  return true;
};

export const MESSAGE_VARS = ["اسم_الطالب", "الحلقة", "اسم_ولي_الأمر"] as const;
