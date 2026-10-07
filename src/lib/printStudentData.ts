const esc = (v: any) =>
  String(v ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
const yn = (b: any) => (b === true ? "نعم" : b === false ? "لا" : "");

export const printStudentData = (s: any) => {
  if (!s) return;
  const sections: [string, [string, any][]][] = [
    ["البيانات الشخصية", [
      ["الاسم", s.full_name], ["كود الطالب", s.student_code], ["رقم الهوية", s.national_id],
      ["الجنسية", s.nationality], ["تاريخ الميلاد (هجري)", s.birth_date_hijri],
      ["تاريخ الميلاد (ميلادي)", s.birth_date_gregorian], ["المدرسة", s.school_name],
      ["الصف", s.grade], ["جوال الطالب", s.student_phone], ["مقر السكن", s.residence_location],
    ]],
    ["بيانات ولي الأمر", [
      ["اسم ولي الأمر", s.guardian_name], ["صلة القرابة", s.guardian_relation],
      ["هوية ولي الأمر", s.guardian_national_id], ["عمل ولي الأمر", s.guardian_work],
      ["الجوال", s.guardian_phone], ["جوال بديل", s.guardian_phone_alt],
      ["يعيش مع", s.lives_with], ["المرافق", s.accompanied_by],
    ]],
    ["البيانات التعليمية", [
      ["الحلقة", s.halaqat?.name], ["الحالة", s.status], ["تاريخ الالتحاق", s.join_date],
      ["مقدار الحفظ عند التسجيل", s.memorization_amount], ["الأوجه المحفوظة", s.total_memorized_pages],
      ["سبق التسجيل", yn(s.previously_enrolled)], ["ملاحظات", s.notes],
    ]],
  ];
  const body = sections.map(([t, rows]) =>
    `<h2>${t}</h2><table>${rows.map(([k, v]) => `<tr><th>${k}</th><td>${esc(v) || "—"}</td></tr>`).join("")}</table>`
  ).join("");
  const w = window.open("", "_blank");
  if (!w) return;
  w.document.write(`<html dir="rtl" lang="ar"><head><title>بيانات ${esc(s.full_name)}</title>
<style>body{font-family:'IBM Plex Sans Arabic',Tahoma,sans-serif;padding:24px;color:#1a2e22}
h1{text-align:center;color:#1f4d36;margin:0}p.sub{text-align:center;margin:4px 0 16px}
h2{background:#1f4d36;color:#fff;padding:6px 10px;font-size:15px;margin:16px 0 0}
table{width:100%;border-collapse:collapse}th,td{border:1px solid #c9bfa5;padding:6px 10px;font-size:13px;text-align:right}
th{background:#f3eddc;width:35%}</style></head><body>
<h1>مجمع حويلان لتحفيظ القرآن الكريم</h1><p class="sub">بطاقة بيانات الطالب</p>${body}
<script>window.onload=()=>{window.print()}</script></body></html>`);
  w.document.close();
};
