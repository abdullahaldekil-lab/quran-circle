// Maps enrollment request form_data to students columns (only non-empty values).
export const mapFormDataToStudent = (fd: Record<string, any> | null | undefined) => {
  const f = fd || {};
  const v = (x: any) => (x === undefined || x === null || String(x).trim() === "" ? undefined : String(x).trim());
  const out: Record<string, any> = {
    national_id: v(f.student_id_number),
    nationality: v(f.student_nationality),
    school_name: v(f.student_school),
    grade: v(f.student_grade),
    memorization_amount: v(f.memorization_amount),
    student_phone: v(f.student_phone),
    birth_date_hijri: v(f.student_birth_date_hijri),
    guardian_phone_alt: v(f.guardian_alt_phone),
    guardian_national_id: v(f.guardian_id_number),
    guardian_relation: v(f.guardian_relationship),
    guardian_work: v(f.guardian_job),
    residence_location: v(f.guardian_address),
    accompanied_by: v(f.brought_by),
    lives_with: v(f.living_with),
    lives_with_other: v(f.living_with_other),
    previously_enrolled: f.previous_enrollment === "نعم" ? true : f.previous_enrollment === "لا" ? false : undefined,
  };
  Object.keys(out).forEach((k) => out[k] === undefined && delete out[k]);
  return out;
};
