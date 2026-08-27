/**
 * Permissions Registry — Single Source of Truth
 * ------------------------------------------------
 * كلما أضفت موديولًا أو خدمة جديدة في النظام، أضف صلاحياتها هنا
 * مع تحديد الأدوار الافتراضية المخوّلة. عند فتح صفحة إدارة الصلاحيات
 * (أو الضغط على زر "مزامنة الصلاحيات")، ستُضاف الصلاحيات الناقصة
 * تلقائيًا لقاعدة البيانات وتُربط بالأدوار الافتراضية، دون المساس
 * بأي تخصيص يدوي أجراه المدير سابقًا.
 *
 * ملاحظات:
 * - لا تُحذف الصلاحيات تلقائيًا من DB حتى لو أُزيلت من هذا السجل
 *   (لتفادي فقدان البيانات)؛ يمكن للمدير حذفها يدويًا.
 * - تحديث `name_ar` أو `category` هنا سيُحدّثها في DB أثناء المزامنة.
 */

export type DefaultRole =
  | "manager"
  | "supervisor"
  | "assistant_supervisor"
  | "secretary"
  | "admin_staff"
  | "teacher"
  | "assistant_teacher";

export interface PermissionDef {
  name: string;          // كود الصلاحية (snake_case، فريد)
  name_ar: string;       // الاسم بالعربية
  category: string;      // فئة التجميع (يطابق categoryLabels)
  description?: string;
  defaultRoles: DefaultRole[]; // الأدوار التي تحصل عليها افتراضيًا
}

// تسميات فئات التجميع المستخدمة في صفحة الصلاحيات
export const categoryLabels: Record<string, string> = {
  halaqat: "الحلقات",
  students: "الطلاب",
  attendance: "الحضور",
  recitation: "التسميع",
  levels: "المستويات",
  madarij: "برنامج مدارج",
  rewards: "المكافآت والترتيب",
  operations: "العمليات والخدمات",
  finance: "المالية والتخطيط",
  admin: "الإدارة",
  enrollment: "القبول والتسجيل",
  settings: "الإعدادات",
  excellence: "التميز",
  narration: "السرد",
  quizzes: "الاختبارات",
  staff: "شؤون الموظفين",
  notifications: "الإشعارات",
  health: "الصحة",
  guardians: "أولياء الأمور",
  programs: "البرامج",
  talqeen: "التلقين",
  tarbawi: "البرامج التربوية",
  summer: "البرنامج الصيفي",
  certificates: "الشهادات",
};

// ملاحظة: المدير (manager) يحصل تلقائيًا على كل الصلاحيات عبر has_permission()،
// لكننا نُضيفه في defaultRoles أيضًا ليظهر مفعّلًا بصريًا في صفحة الأدوار.

export const PERMISSIONS_REGISTRY: PermissionDef[] = [
  // ===== الإدارة =====
  { name: "manage_permissions", name_ar: "إدارة الصلاحيات", category: "admin", defaultRoles: ["manager"] },
  { name: "manage_users",       name_ar: "إدارة المستخدمين", category: "admin", defaultRoles: ["manager"] },
  { name: "manage_roles",       name_ar: "إدارة الأدوار",     category: "admin", defaultRoles: ["manager"] },
  { name: "view_permissions_sync_log", name_ar: "عرض سجل مزامنة الصلاحيات", category: "admin", defaultRoles: ["manager"] },
  { name: "view_admin_dashboard", name_ar: "عرض لوحة الإدارة", category: "admin", defaultRoles: ["manager", "supervisor"] },

  // ===== الحضور =====
  { name: "mark_attendance",     name_ar: "تسجيل الحضور",     category: "attendance", defaultRoles: ["manager", "secretary", "admin_staff", "teacher", "assistant_teacher"] },
  { name: "edit_attendance",     name_ar: "تعديل الحضور",     category: "attendance", defaultRoles: ["manager", "secretary", "admin_staff"] },
  { name: "view_attendance_log", name_ar: "عرض سجل الحضور",   category: "attendance", defaultRoles: ["manager", "supervisor", "assistant_supervisor", "secretary", "admin_staff", "teacher", "assistant_teacher"] },

  // ===== القبول والتسجيل =====
  { name: "manage_bulk_import",         name_ar: "إضافة جماعية",              category: "enrollment", defaultRoles: ["manager", "secretary", "admin_staff"] },
  { name: "manage_enrollment",          name_ar: "إدارة طلبات الالتحاق",      category: "enrollment", defaultRoles: ["manager", "supervisor", "assistant_supervisor", "secretary", "admin_staff"] },
  { name: "view_enrollment_requests",   name_ar: "عرض طلبات الالتحاق",        category: "enrollment", defaultRoles: ["manager", "supervisor", "assistant_supervisor", "secretary", "admin_staff"] },
  { name: "approve_enrollment_requests", name_ar: "الموافقة على طلبات الالتحاق", category: "enrollment", defaultRoles: ["manager", "supervisor", "assistant_supervisor", "secretary", "admin_staff"] },
  { name: "manage_pre_registration",    name_ar: "إدارة التسجيل المسبق",      category: "enrollment", defaultRoles: ["manager", "supervisor", "assistant_supervisor", "secretary", "admin_staff"] },

  // ===== التميز =====
  { name: "manage_distinguished_students", name_ar: "إدارة الطلاب المتميزين", category: "excellence", defaultRoles: ["manager", "supervisor"] },
  { name: "manage_excellence_sessions",    name_ar: "إدارة جلسات التميز",     category: "excellence", defaultRoles: ["manager", "supervisor", "assistant_supervisor"] },
  { name: "manage_excellence_settings",    name_ar: "إدارة إعدادات التميز",   category: "excellence", defaultRoles: ["manager", "supervisor"] },
  { name: "manage_excellence_tracks",      name_ar: "إدارة مسارات التميز",    category: "excellence", defaultRoles: ["manager", "supervisor"] },
  { name: "view_excellence",               name_ar: "عرض التميز",             category: "excellence", defaultRoles: ["manager", "supervisor", "assistant_supervisor", "teacher", "assistant_teacher"] },
  { name: "view_excellence_reports",       name_ar: "عرض تقارير التميز",      category: "excellence", defaultRoles: ["manager", "supervisor", "assistant_supervisor"] },

  // ===== المالية والتخطيط =====
  { name: "manage_finance",        name_ar: "إدارة المالية",            category: "finance", defaultRoles: ["manager"] },
  { name: "manage_strategic_plan", name_ar: "إدارة الخطة الاستراتيجية", category: "finance", defaultRoles: ["manager", "supervisor"] },
  { name: "view_kpi",              name_ar: "عرض مؤشرات الأداء",        category: "finance", defaultRoles: ["manager", "supervisor", "assistant_supervisor"] },

  // ===== أولياء الأمور =====
  { name: "manage_guardians", name_ar: "إدارة أولياء الأمور", category: "guardians", defaultRoles: ["manager", "secretary", "admin_staff"] },
  { name: "send_guardian_whatsapp",   name_ar: "إرسال رسائل واتساب لأولياء الأمور", category: "guardians", defaultRoles: ["manager", "supervisor", "secretary", "admin_staff", "teacher"] },
  { name: "manage_guardian_messages", name_ar: "إدارة رسائل أولياء الأمور", category: "guardians", defaultRoles: ["manager", "supervisor", "secretary", "admin_staff"] },
  { name: "manage_guardian_excuses",  name_ar: "إدارة أعذار الطلاب",       category: "guardians", defaultRoles: ["manager", "supervisor", "assistant_supervisor", "secretary", "admin_staff"] },
  { name: "manage_guardian_approvals", name_ar: "اعتماد ربط أولياء الأمور", category: "guardians", defaultRoles: ["manager", "secretary"] },
  { name: "view_teacher_evaluations", name_ar: "عرض تقييمات المعلمين",     category: "guardians", defaultRoles: ["manager", "supervisor"] },

  // ===== الحلقات =====
  { name: "view_halaqat",   name_ar: "عرض الحلقات", category: "halaqat", defaultRoles: ["manager", "supervisor", "assistant_supervisor", "secretary", "admin_staff", "teacher", "assistant_teacher"] },
  { name: "create_halaqa",  name_ar: "إضافة حلقة",  category: "halaqat", defaultRoles: ["manager", "secretary"] },
  { name: "edit_halaqa",    name_ar: "تعديل حلقة",  category: "halaqat", defaultRoles: ["manager", "secretary"] },
  { name: "delete_halaqa",  name_ar: "حذف حلقة",    category: "halaqat", defaultRoles: ["manager", "secretary"] },
  { name: "assign_teacher", name_ar: "ربط معلم بحلقة", category: "halaqat", defaultRoles: ["manager", "secretary"] },
  { name: "create_talqeen_halaqa", name_ar: "إضافة حلقة تلقين", category: "halaqat", defaultRoles: ["manager", "secretary"] },
  { name: "edit_talqeen_halaqa",   name_ar: "تعديل حلقة تلقين", category: "halaqat", defaultRoles: ["manager", "secretary"] },
  { name: "delete_talqeen_halaqa", name_ar: "حذف حلقة تلقين",   category: "halaqat", defaultRoles: ["manager", "secretary"] },

  // ===== الصحة =====
  { name: "manage_health", name_ar: "إدارة السجل الصحي", category: "health", defaultRoles: ["manager", "secretary", "admin_staff"] },

  // ===== المستويات =====
  { name: "manage_levels", name_ar: "إدارة المستويات", category: "levels", defaultRoles: ["manager", "secretary"] },

  // ===== مدارج =====
  { name: "manage_madarij_tracks",   name_ar: "إدارة مسارات مدارج",   category: "madarij", defaultRoles: ["manager", "supervisor", "assistant_supervisor"] },
  { name: "manage_madarij_levels",   name_ar: "إدارة مستويات مدارج",  category: "madarij", defaultRoles: ["manager", "supervisor", "assistant_supervisor"] },
  { name: "manage_madarij_progress", name_ar: "إدارة المتابعة اليومية", category: "madarij", defaultRoles: ["manager", "supervisor", "assistant_supervisor", "teacher"] },
  { name: "manage_madarij_exams",    name_ar: "إدارة اختبارات الحزب", category: "madarij", defaultRoles: ["manager", "supervisor", "assistant_supervisor", "teacher"] },
  { name: "manage_madarij_mistakes", name_ar: "إدارة الأخطاء",        category: "madarij", defaultRoles: ["manager", "supervisor", "assistant_supervisor", "teacher"] },
  { name: "manage_madarij_enrollments", name_ar: "إدارة التسجيل في مدارج", category: "madarij", defaultRoles: ["manager", "supervisor", "assistant_supervisor"] },
  { name: "manage_memorization_path",   name_ar: "إدارة مسار الحفظ (نصف وجه/وجه)", category: "madarij", defaultRoles: ["manager", "supervisor", "assistant_supervisor"] },
  { name: "manage_annual_plans",        name_ar: "إدارة الخطط السنوية",   category: "madarij", defaultRoles: ["manager", "supervisor", "assistant_supervisor", "teacher"] },
  { name: "view_madarij_reports",       name_ar: "عرض تقارير مدارج",      category: "madarij", defaultRoles: ["manager", "supervisor", "assistant_supervisor", "teacher"] },

  // ===== السرد =====
  { name: "view_narration",            name_ar: "عرض السرد",            category: "narration", defaultRoles: ["manager", "supervisor", "assistant_supervisor", "teacher", "assistant_teacher"] },
  { name: "view_narration_reports",    name_ar: "عرض تقارير السرد",     category: "narration", defaultRoles: ["manager", "supervisor", "assistant_supervisor", "teacher"] },
  { name: "manage_narration_sessions", name_ar: "إدارة جلسات السرد",    category: "narration", defaultRoles: ["manager", "supervisor", "assistant_supervisor", "teacher"] },
  { name: "manage_narration_goals",    name_ar: "إدارة أهداف السرد",    category: "narration", defaultRoles: ["manager", "supervisor"] },
  { name: "manage_narration_tests",    name_ar: "إدارة اختبارات السرد", category: "narration", defaultRoles: ["manager", "supervisor"] },

  // ===== الإشعارات =====
  { name: "send_notifications",          name_ar: "إرسال إشعارات",          category: "notifications", defaultRoles: ["manager", "supervisor"] },
  { name: "send_bulk_email",             name_ar: "إرسال بريد جماعي",       category: "notifications", defaultRoles: ["manager"] },
  { name: "manage_notifications",        name_ar: "إدارة الإشعارات",        category: "notifications", defaultRoles: ["manager", "supervisor"] },
  { name: "manage_notification_templates", name_ar: "إدارة قوالب الإشعارات", category: "notifications", defaultRoles: ["manager"] },

  // ===== العمليات والخدمات =====
  { name: "manage_buses",        name_ar: "إدارة الباصات",   category: "operations", defaultRoles: ["manager", "secretary", "admin_staff"] },
  { name: "manage_documents",    name_ar: "إدارة المستندات", category: "operations", defaultRoles: ["manager", "supervisor", "assistant_supervisor", "teacher"] },
  { name: "manage_instructions", name_ar: "إدارة التعليمات", category: "operations", defaultRoles: ["manager"] },
  { name: "manage_trips",        name_ar: "إدارة الرحلات",   category: "operations", defaultRoles: ["manager", "secretary", "admin_staff", "teacher"] },

  // ===== البرامج =====
  { name: "view_programs_overview",   name_ar: "عرض نظرة البرامج",      category: "programs", defaultRoles: ["manager", "supervisor", "assistant_supervisor"] },
  { name: "view_program_materials",   name_ar: "عرض مواد البرامج",      category: "programs", defaultRoles: ["manager", "supervisor", "assistant_supervisor", "teacher", "assistant_teacher"] },
  { name: "manage_program_materials", name_ar: "إدارة مواد البرامج",    category: "programs", defaultRoles: ["manager", "supervisor"] },
  { name: "view_summer_programs",     name_ar: "عرض البرامج الصيفية",   category: "programs", defaultRoles: ["manager", "supervisor", "assistant_supervisor", "teacher"] },
  { name: "manage_summer_programs",   name_ar: "إدارة البرامج الصيفية", category: "programs", defaultRoles: ["manager", "supervisor"] },
  { name: "nazem_export",             name_ar: "تصدير ناظم",            category: "programs", defaultRoles: ["manager", "supervisor"] },
  { name: "view_material_stats",      name_ar: "عرض إحصاءات مشاهدة المواد", category: "programs", defaultRoles: ["manager", "supervisor", "assistant_supervisor"] },
  { name: "assign_program_materials", name_ar: "إسناد المواد للحلقات",   category: "programs", defaultRoles: ["manager", "supervisor", "assistant_supervisor"] },

  // ===== البرنامج الصيفي =====
  { name: "manage_summer_maqare",       name_ar: "إدارة المقارئ الصيفية",   category: "summer", defaultRoles: ["manager", "supervisor", "assistant_supervisor"] },
  { name: "manage_summer_students",     name_ar: "إدارة طلاب البرنامج الصيفي", category: "summer", defaultRoles: ["manager", "supervisor", "assistant_supervisor", "secretary"] },
  { name: "manage_summer_daily_records", name_ar: "تسجيل المتابعة اليومية الصيفية", category: "summer", defaultRoles: ["manager", "supervisor", "assistant_supervisor", "teacher"] },
  { name: "manage_summer_attendance",   name_ar: "حضور البرنامج الصيفي",   category: "summer", defaultRoles: ["manager", "supervisor", "assistant_supervisor", "teacher", "assistant_teacher"] },
  { name: "view_summer_reports",        name_ar: "عرض تقارير البرنامج الصيفي", category: "summer", defaultRoles: ["manager", "supervisor", "assistant_supervisor"] },

  // ===== البرامج التربوية =====
  { name: "view_tarbawi_programs",       name_ar: "عرض البرامج التربوية",     category: "tarbawi", defaultRoles: ["manager", "supervisor", "assistant_supervisor", "teacher", "assistant_teacher"] },
  { name: "manage_tarbawi_programs",     name_ar: "إدارة البرامج التربوية",   category: "tarbawi", defaultRoles: ["manager", "supervisor"] },
  { name: "manage_tarbawi_weekly",       name_ar: "المتابعة الأسبوعية التربوية", category: "tarbawi", defaultRoles: ["manager", "supervisor", "assistant_supervisor", "teacher"] },
  { name: "manage_tarbawi_exams",        name_ar: "إدارة الاختبارات التربوية", category: "tarbawi", defaultRoles: ["manager", "supervisor", "teacher"] },
  { name: "manage_tarbawi_practice_quizzes", name_ar: "إدارة الاختبارات التدريبية", category: "tarbawi", defaultRoles: ["manager", "supervisor", "teacher"] },
  { name: "view_tarbawi_leaderboard",    name_ar: "عرض لوحة الصدارة التربوية", category: "tarbawi", defaultRoles: ["manager", "supervisor", "assistant_supervisor", "teacher", "assistant_teacher"] },
  { name: "view_tarbawi_reports",        name_ar: "عرض التقارير التربوية",    category: "tarbawi", defaultRoles: ["manager", "supervisor", "assistant_supervisor"] },
  { name: "manage_tarbawi_surveys",      name_ar: "إدارة الاستبانات التربوية", category: "tarbawi", defaultRoles: ["manager", "supervisor"] },
  { name: "manage_tarbawi_calendar",     name_ar: "إدارة تقويم البرامج التربوية", category: "tarbawi", defaultRoles: ["manager", "supervisor", "assistant_supervisor"] },
  { name: "view_tarbawi_history",        name_ar: "عرض السجل التربوي للطالب", category: "tarbawi", defaultRoles: ["manager", "supervisor", "assistant_supervisor", "teacher"] },

  // ===== الاختبارات =====
  { name: "manage_quizzes",     name_ar: "إدارة الاختبارات",      category: "quizzes", defaultRoles: ["manager", "supervisor"] },
  { name: "view_quiz_results",  name_ar: "عرض نتائج الاختبارات", category: "quizzes", defaultRoles: ["manager", "supervisor", "assistant_supervisor", "teacher", "assistant_teacher"] },

  // ===== التسميع =====
  { name: "view_recitations", name_ar: "عرض التسميعات", category: "recitation", defaultRoles: ["manager", "supervisor", "assistant_supervisor", "teacher", "assistant_teacher"] },
  { name: "mark_recitation",  name_ar: "تسجيل التسميع", category: "recitation", defaultRoles: ["manager", "teacher", "assistant_teacher"] },
  { name: "edit_recitation",  name_ar: "تعديل التسميع", category: "recitation", defaultRoles: ["manager", "teacher"] },
  { name: "delete_recitation", name_ar: "حذف التسميع",  category: "recitation", defaultRoles: ["manager"] },
  { name: "manage_recitation_mistakes", name_ar: "إدارة تصنيف أخطاء التسميع", category: "recitation", defaultRoles: ["manager", "supervisor", "teacher"] },

  // ===== المكافآت والترتيب =====
  { name: "manage_rankings", name_ar: "إدارة الترتيب", category: "rewards", defaultRoles: ["manager", "teacher", "assistant_teacher"] },
  { name: "manage_rewards",  name_ar: "إدارة المكافآت", category: "rewards", defaultRoles: ["manager"] },

  // ===== الإعدادات =====
  { name: "manage_academic_calendar", name_ar: "إدارة التقويم الأكاديمي", category: "settings", defaultRoles: ["manager", "supervisor", "assistant_supervisor", "secretary", "admin_staff", "teacher", "assistant_teacher"] },
  { name: "manage_settings",          name_ar: "إدارة الإعدادات",         category: "settings", defaultRoles: ["manager"] },

  // ===== شؤون الموظفين =====
  { name: "view_staff_attendance",       name_ar: "عرض حضور الموظفين",   category: "staff", defaultRoles: ["manager", "supervisor", "secretary"] },
  { name: "manage_staff_attendance",     name_ar: "إدارة حضور الموظفين", category: "staff", defaultRoles: ["manager", "supervisor", "secretary", "admin_staff"] },
  { name: "manage_staff_shifts",         name_ar: "إدارة جداول الدوام",  category: "staff", defaultRoles: ["manager", "supervisor", "secretary"] },
  { name: "view_staff_tasks",            name_ar: "عرض المهام",          category: "staff", defaultRoles: ["manager", "supervisor", "assistant_supervisor", "secretary", "admin_staff", "teacher", "assistant_teacher"] },
  { name: "manage_staff_tasks",          name_ar: "إدارة المهام",        category: "staff", defaultRoles: ["manager", "supervisor"] },
  { name: "view_staff_tasks_analytics",  name_ar: "عرض تحليلات المهام",  category: "staff", defaultRoles: ["manager", "supervisor", "assistant_supervisor"] },
  { name: "manage_internal_requests",    name_ar: "إدارة الطلبات الداخلية", category: "staff", defaultRoles: ["manager", "supervisor", "assistant_supervisor", "secretary", "admin_staff", "teacher", "assistant_teacher"] },
  { name: "view_work_hub",               name_ar: "عرض المهام والطلبات",  category: "staff", defaultRoles: ["manager", "supervisor", "assistant_supervisor", "secretary", "admin_staff", "teacher", "assistant_teacher"] },
  { name: "manage_tasks_calendar",       name_ar: "إدارة تقويم المهام الهجري", category: "staff", defaultRoles: ["manager", "supervisor", "assistant_supervisor", "secretary"] },
  { name: "manage_staff_qr",             name_ar: "إدارة بصمة QR للحضور", category: "staff", defaultRoles: ["manager", "supervisor", "secretary"] },
  { name: "staff_qr_checkin",            name_ar: "تسجيل الحضور بالباركود", category: "staff", defaultRoles: ["manager", "supervisor", "assistant_supervisor", "secretary", "admin_staff", "teacher", "assistant_teacher"] },
  { name: "view_staff_attendance_audit", name_ar: "عرض سجل تدقيق حضور الموظفين", category: "staff", defaultRoles: ["manager", "supervisor"] },

  // ===== الطلاب =====
  { name: "view_students",   name_ar: "عرض الطلاب",   category: "students", defaultRoles: ["manager", "supervisor", "assistant_supervisor", "secretary", "admin_staff", "teacher", "assistant_teacher"] },
  { name: "create_student",  name_ar: "إضافة طالب",   category: "students", defaultRoles: ["manager", "secretary", "admin_staff"] },
  { name: "edit_student",    name_ar: "تعديل طالب",   category: "students", defaultRoles: ["manager", "secretary", "admin_staff"] },
  { name: "delete_student",  name_ar: "حذف طالب",     category: "students", defaultRoles: ["manager"] },
  { name: "view_inactive_students", name_ar: "عرض الطلاب غير النشطين", category: "students", defaultRoles: ["manager", "supervisor", "assistant_supervisor", "secretary", "admin_staff"] },
  { name: "manage_student_status",   name_ar: "إدارة حالة الطالب",      category: "students", defaultRoles: ["manager", "supervisor", "secretary"] },
  { name: "view_student_reports",    name_ar: "عرض تقارير الطلاب",      category: "students", defaultRoles: ["manager", "supervisor", "assistant_supervisor", "secretary", "admin_staff", "teacher"] },

  // ===== التلقين (موديول جديد) =====
  { name: "view_talqeen",            name_ar: "عرض حلقات التلقين",     category: "talqeen", defaultRoles: ["manager", "supervisor", "assistant_supervisor", "secretary", "admin_staff", "teacher", "assistant_teacher"] },
  { name: "manage_talqeen_curricula", name_ar: "إدارة مناهج التلقين",  category: "talqeen", defaultRoles: ["manager", "supervisor"] },
  { name: "manage_talqeen_sessions",  name_ar: "إدارة جلسات التلقين",  category: "talqeen", defaultRoles: ["manager", "supervisor", "teacher"] },
  { name: "manage_talqeen_tests",     name_ar: "إدارة اختبارات التلقين", category: "talqeen", defaultRoles: ["manager", "supervisor", "teacher"] },
  { name: "view_talqeen_supervisor_board", name_ar: "لوحة مراقبة مشرف التلقين", category: "talqeen", defaultRoles: ["manager", "supervisor"] },
  { name: "manage_talqeen_programs",  name_ar: "إدارة برامج التلقين",   category: "talqeen", defaultRoles: ["manager", "supervisor"] },
  { name: "manage_talqeen_daily_record", name_ar: "تسجيل اليوم (حضور/درس/تربوي/واجبات)", category: "talqeen", defaultRoles: ["manager", "supervisor", "teacher", "assistant_teacher"] },

  // ===== الشهادات (موديول جديد) =====
  { name: "issue_certificates",  name_ar: "إصدار الشهادات",  category: "certificates", defaultRoles: ["manager", "supervisor", "teacher"] },
  { name: "verify_certificates", name_ar: "التحقق من الشهادات", category: "certificates", defaultRoles: ["manager", "supervisor", "assistant_supervisor", "secretary", "admin_staff", "teacher", "assistant_teacher"] },

  // ===== إضافات: صلاحيات تفصيلية للصفحات التي لم تكن مسجّلة =====

  // لوحات ومسارات عامة
  { name: "view_dashboard",            name_ar: "عرض اللوحة الرئيسية",       category: "admin", defaultRoles: ["manager", "supervisor", "assistant_supervisor", "secretary", "admin_staff", "teacher", "assistant_teacher"] },
  { name: "manage_own_profile",        name_ar: "تعديل الملف الشخصي",        category: "admin", defaultRoles: ["manager", "supervisor", "assistant_supervisor", "secretary", "admin_staff", "teacher", "assistant_teacher"] },
  { name: "view_teacher_quick_panel",  name_ar: "عرض لوحة المعلم السريعة",   category: "admin", defaultRoles: ["manager", "teacher", "assistant_teacher"] },

  // الحضور والتقارير
  { name: "view_attendance_audit",         name_ar: "عرض سجل تدقيق الحضور",     category: "attendance", defaultRoles: ["manager", "supervisor"] },
  { name: "view_student_attendance_report", name_ar: "عرض تقرير حضور الطالب المطبوع", category: "attendance", defaultRoles: ["manager", "supervisor", "assistant_supervisor", "secretary", "admin_staff", "teacher"] },

  // التحضير والاستعداد
  { name: "manage_preparation",  name_ar: "إدارة التحضير اليومي", category: "operations", defaultRoles: ["manager", "supervisor", "teacher", "assistant_teacher"] },
  { name: "manage_enrollment_form", name_ar: "تعبئة نموذج التسجيل للطالب", category: "enrollment", defaultRoles: ["manager", "secretary", "admin_staff"] },

  // الاختبارات (تفصيلي)
  { name: "manage_student_quiz",  name_ar: "تنفيذ اختبار الطالب",        category: "quizzes", defaultRoles: ["manager", "supervisor", "teacher", "assistant_teacher"] },
  { name: "view_quiz_comparison", name_ar: "عرض مقارنة الاختبارات",      category: "quizzes", defaultRoles: ["manager", "supervisor", "assistant_supervisor"] },
  { name: "manage_program_quiz",  name_ar: "إدارة اختبار البرامج",       category: "quizzes", defaultRoles: ["manager", "supervisor", "assistant_supervisor"] },

  // السرد (تفصيلي)
  { name: "manage_review_test",   name_ar: "إدارة اختبار المراجعة",      category: "narration", defaultRoles: ["manager", "supervisor", "teacher"] },
  { name: "view_narration_stats", name_ar: "عرض إحصاءات السرد",          category: "narration", defaultRoles: ["manager", "supervisor", "assistant_supervisor"] },
  { name: "manage_narration_test_settings", name_ar: "إدارة إعدادات اختبار السرد", category: "narration", defaultRoles: ["manager", "supervisor"] },
  { name: "view_student_narration_progress", name_ar: "عرض تقدم الطالب في السرد", category: "narration", defaultRoles: ["manager", "supervisor", "assistant_supervisor", "teacher"] },

  // التميز (تفصيلي)
  { name: "view_excellence_comparison", name_ar: "عرض مقارنة التميز", category: "excellence", defaultRoles: ["manager", "supervisor", "assistant_supervisor"] },

  // الإشعارات (تفصيلي)
  { name: "view_notification_log",         name_ar: "عرض سجل الإشعارات",        category: "notifications", defaultRoles: ["manager", "supervisor"] },
  { name: "manage_notification_preferences", name_ar: "تعديل تفضيلات الإشعارات", category: "notifications", defaultRoles: ["manager", "supervisor", "assistant_supervisor", "secretary", "admin_staff", "teacher", "assistant_teacher"] },

  // شؤون الموظفين (تفصيلي)
  { name: "view_staff_attendance_log", name_ar: "عرض سجل حضور الموظفين", category: "staff", defaultRoles: ["manager", "supervisor", "secretary"] },

  // مدارج (تفصيلي)
  { name: "view_student_annual_plan", name_ar: "عرض الخطة السنوية للطالب", category: "madarij", defaultRoles: ["manager", "supervisor", "assistant_supervisor", "teacher"] },
  { name: "view_madarij", name_ar: "عرض برنامج مدارج", category: "madarij", defaultRoles: ["manager", "supervisor", "assistant_supervisor", "teacher", "assistant_teacher"] },

  // إضافات التدقيق: صفحات كانت بلا صلاحية مخصّصة
  { name: "view_tarbawi_follow_up", name_ar: "عرض المتابعة التربوية", category: "tarbawi", defaultRoles: ["manager", "supervisor", "assistant_supervisor", "teacher", "assistant_teacher"] },
  { name: "manage_excellence_track_settings", name_ar: "إدارة إعدادات مسار التميز", category: "excellence", defaultRoles: ["manager", "supervisor"] },
  { name: "view_strategic_dashboard", name_ar: "عرض لوحة الاستراتيجية", category: "finance", defaultRoles: ["manager", "supervisor", "assistant_supervisor"] },
  { name: "view_student_portal", name_ar: "عرض بوابة الطالب (إداريًا)", category: "students", defaultRoles: ["manager", "supervisor", "assistant_supervisor", "secretary", "admin_staff", "teacher", "assistant_teacher"] },
  { name: "view_documents", name_ar: "عرض المستندات", category: "operations", defaultRoles: ["manager", "supervisor", "assistant_supervisor", "secretary", "admin_staff", "teacher", "assistant_teacher"] },
];


