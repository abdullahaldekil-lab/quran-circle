import { describe, it, expect } from "vitest";
import {
  normalizeWhatsappNumber,
  applyMessageVars,
  buildWhatsappLink,
  resolveGuardianPhone,
} from "./whatsapp";

describe("normalizeWhatsappNumber", () => {
  it("يحوّل الرقم المحلي إلى صيغة 966", () => {
    expect(normalizeWhatsappNumber("0501234567")).toBe("966501234567");
    expect(normalizeWhatsappNumber("501234567")).toBe("966501234567");
    expect(normalizeWhatsappNumber("05 01 23 45 67")).toBe("966501234567");
    expect(normalizeWhatsappNumber("+966 50 123 4567")).toBe("966501234567");
    expect(normalizeWhatsappNumber("00966501234567")).toBe("966501234567");
    expect(normalizeWhatsappNumber("9660501234567")).toBe("966501234567");
  });

  it("يتعامل مع الأرقام العربية", () => {
    expect(normalizeWhatsappNumber("٠٥٠١٢٣٤٥٦٧")).toBe("966501234567");
  });

  it("يرفض الأرقام غير الصالحة", () => {
    expect(normalizeWhatsappNumber("")).toBeNull();
    expect(normalizeWhatsappNumber(null)).toBeNull();
    expect(normalizeWhatsappNumber("123")).toBeNull();
    expect(normalizeWhatsappNumber("96650123")).toBeNull();
  });
});

describe("applyMessageVars", () => {
  it("يستبدل المتغيرات العربية", () => {
    expect(
      applyMessageVars("مرحبًا {اسم_ولي_الأمر}، ابنكم {اسم_الطالب} في {الحلقة}", {
        اسم_ولي_الأمر: "أبو محمد",
        اسم_الطالب: "محمد",
        الحلقة: "حلقة النور",
      }),
    ).toBe("مرحبًا أبو محمد، ابنكم محمد في حلقة النور");
  });

  it("يستبدل القيم الفارغة بنص فارغ", () => {
    expect(applyMessageVars("ابنكم {اسم_الطالب}", { اسم_الطالب: null })).toBe("ابنكم ");
  });
});

describe("buildWhatsappLink", () => {
  // بيئة الاختبار (jsdom) تُعد جهاز كمبيوتر، فيُستخدم واتساب ويب
  it("يبني رابط واتساب ويب بالنص المشفّر على الكمبيوتر", () => {
    expect(buildWhatsappLink("0501234567", "سلام")).toBe(
      `https://web.whatsapp.com/send?phone=966501234567&text=${encodeURIComponent("سلام")}`,
    );
  });

  it("يبني رابطًا بدون نص", () => {
    expect(buildWhatsappLink("0501234567")).toBe(
      "https://web.whatsapp.com/send?phone=966501234567",
    );
  });

  it("يعيد null لرقم غير صالح", () => {
    expect(buildWhatsappLink("abc", "سلام")).toBeNull();
  });
});

describe("resolveGuardianPhone", () => {
  it("يفضّل رقم ملف ولي الأمر", () => {
    expect(resolveGuardianPhone("0501111111", "0502222222")).toBe("966501111111");
  });

  it("يرجع لرقم الطالب عند غياب رقم ولي الأمر", () => {
    expect(resolveGuardianPhone(null, "0502222222")).toBe("966502222222");
    expect(resolveGuardianPhone("xx", "0502222222")).toBe("966502222222");
  });

  it("يعيد null عند عدم وجود أي رقم", () => {
    expect(resolveGuardianPhone(null, null)).toBeNull();
  });
});
