
-- 1. Create roles table
CREATE TABLE public.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  name_ar text NOT NULL,
  description text,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

-- 2. Create permissions table
CREATE TABLE public.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  name_ar text NOT NULL,
  category text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

-- 3. Create role_permissions table
CREATE TABLE public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  UNIQUE(role_id, permission_id)
);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- 4. Create user_permissions table
CREATE TABLE public.user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  granted boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, permission_id)
);

ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- 5. Security definer function to check permissions
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE
      -- Manager always has all permissions
      WHEN (SELECT role::text FROM public.profiles WHERE id = _user_id) = 'manager' THEN true
      -- Check user-level override (granted = false means explicitly denied)
      WHEN EXISTS (
        SELECT 1 FROM public.user_permissions up
        JOIN public.permissions p ON p.id = up.permission_id
        WHERE up.user_id = _user_id AND p.name = _permission_name AND up.granted = true
      ) THEN true
      -- Check if explicitly denied at user level
      WHEN EXISTS (
        SELECT 1 FROM public.user_permissions up
        JOIN public.permissions p ON p.id = up.permission_id
        WHERE up.user_id = _user_id AND p.name = _permission_name AND up.granted = false
      ) THEN false
      -- Check role-level permissions
      WHEN EXISTS (
        SELECT 1 FROM public.role_permissions rp
        JOIN public.permissions p ON p.id = rp.permission_id
        JOIN public.roles r ON r.id = rp.role_id
        WHERE r.name = (SELECT role::text FROM public.profiles WHERE id = _user_id)
          AND p.name = _permission_name
      ) THEN true
      ELSE false
    END
$$;

-- 6. RLS Policies

-- roles: managers can manage, all staff can view
CREATE POLICY "Managers can manage roles" ON public.roles
  FOR ALL TO authenticated
  USING (get_staff_role(auth.uid()) = 'manager')
  WITH CHECK (get_staff_role(auth.uid()) = 'manager');

CREATE POLICY "Staff can view roles" ON public.roles
  FOR SELECT TO authenticated
  USING (get_staff_role(auth.uid()) IS NOT NULL);

-- permissions: managers can manage, all staff can view
CREATE POLICY "Managers can manage permissions" ON public.permissions
  FOR ALL TO authenticated
  USING (get_staff_role(auth.uid()) = 'manager')
  WITH CHECK (get_staff_role(auth.uid()) = 'manager');

CREATE POLICY "Staff can view permissions" ON public.permissions
  FOR SELECT TO authenticated
  USING (get_staff_role(auth.uid()) IS NOT NULL);

-- role_permissions: managers can manage, all staff can view
CREATE POLICY "Managers can manage role_permissions" ON public.role_permissions
  FOR ALL TO authenticated
  USING (get_staff_role(auth.uid()) = 'manager')
  WITH CHECK (get_staff_role(auth.uid()) = 'manager');

CREATE POLICY "Staff can view role_permissions" ON public.role_permissions
  FOR SELECT TO authenticated
  USING (get_staff_role(auth.uid()) IS NOT NULL);

-- user_permissions: managers can manage, users can view own
CREATE POLICY "Managers can manage user_permissions" ON public.user_permissions
  FOR ALL TO authenticated
  USING (get_staff_role(auth.uid()) = 'manager')
  WITH CHECK (get_staff_role(auth.uid()) = 'manager');

CREATE POLICY "Users can view own permissions" ON public.user_permissions
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Staff can view all user_permissions" ON public.user_permissions
  FOR SELECT TO authenticated
  USING (get_staff_role(auth.uid()) IS NOT NULL);

-- 7. Seed default roles
INSERT INTO public.roles (name, name_ar, description, is_system) VALUES
  ('manager', 'مدير', 'صلاحيات كاملة على النظام', true),
  ('supervisor', 'مشرف', 'إشراف أكاديمي', true),
  ('assistant_supervisor', 'مساعد مشرف', 'مساعد إشراف أكاديمي', true),
  ('secretary', 'سكرتير', 'إدارة إدارية', true),
  ('admin_staff', 'موظف إداري', 'دعم إداري', true),
  ('teacher', 'معلم', 'تعليم وتسميع', true),
  ('assistant_teacher', 'معلم مساعد', 'مساعد في التعليم', true);

-- 8. Seed permissions
INSERT INTO public.permissions (name, name_ar, category) VALUES
  -- حلقات
  ('view_halaqat', 'عرض الحلقات', 'halaqat'),
  ('create_halaqa', 'إضافة حلقة', 'halaqat'),
  ('edit_halaqa', 'تعديل حلقة', 'halaqat'),
  ('delete_halaqa', 'حذف حلقة', 'halaqat'),
  ('assign_teacher', 'ربط معلم بحلقة', 'halaqat'),
  -- طلاب
  ('view_students', 'عرض الطلاب', 'students'),
  ('create_student', 'إضافة طالب', 'students'),
  ('edit_student', 'تعديل طالب', 'students'),
  ('delete_student', 'حذف طالب', 'students'),
  -- حضور
  ('mark_attendance', 'تسجيل الحضور', 'attendance'),
  ('edit_attendance', 'تعديل الحضور', 'attendance'),
  ('view_attendance_log', 'عرض سجل الحضور', 'attendance'),
  -- تسميع
  ('mark_recitation', 'تسجيل التسميع', 'recitation'),
  ('edit_recitation', 'تعديل التسميع', 'recitation'),
  ('view_recitations', 'عرض التسميعات', 'recitation'),
  -- مستويات
  ('manage_levels', 'إدارة المستويات', 'levels'),
  -- مدارج
  ('manage_madarij_tracks', 'إدارة مسارات مدارج', 'madarij'),
  ('manage_madarij_levels', 'إدارة مستويات مدارج', 'madarij'),
  ('manage_madarij_progress', 'إدارة المتابعة اليومية', 'madarij'),
  ('manage_madarij_exams', 'إدارة اختبارات الحزب', 'madarij'),
  ('manage_madarij_mistakes', 'إدارة الأخطاء', 'madarij'),
  -- مكافآت
  ('manage_rewards', 'إدارة المكافآت', 'rewards'),
  ('manage_rankings', 'إدارة الترتيب', 'rewards'),
  -- رحلات
  ('manage_trips', 'إدارة الرحلات', 'operations'),
  ('manage_buses', 'إدارة الباصات', 'operations'),
  ('manage_instructions', 'إدارة التعليمات', 'operations'),
  ('manage_documents', 'إدارة المستندات', 'operations'),
  -- مالية
  ('manage_finance', 'إدارة المالية', 'finance'),
  ('manage_strategic_plan', 'إدارة الخطة الاستراتيجية', 'finance'),
  ('view_kpi', 'عرض مؤشرات الأداء', 'finance'),
  -- مستخدمين
  ('manage_users', 'إدارة المستخدمين', 'admin'),
  ('manage_permissions', 'إدارة الصلاحيات', 'admin'),
  -- قبول
  ('manage_pre_registration', 'إدارة التسجيل المسبق', 'enrollment'),
  ('manage_enrollment', 'إدارة طلبات الالتحاق', 'enrollment'),
  ('manage_bulk_import', 'إضافة جماعية', 'enrollment'),
  -- إعدادات
  ('manage_settings', 'إدارة الإعدادات', 'settings'),
  ('manage_academic_calendar', 'إدارة التقويم الأكاديمي', 'settings');

-- 9. Seed role_permissions for each default role
-- Manager gets ALL permissions automatically via has_permission function, but we also add them explicitly
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r CROSS JOIN public.permissions p WHERE r.name = 'manager';

-- Supervisor
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'supervisor' AND p.name IN (
  'view_halaqat', 'view_students', 'view_recitations', 'view_attendance_log',
  'manage_madarij_tracks', 'manage_madarij_levels', 'manage_madarij_progress', 'manage_madarij_exams', 'manage_madarij_mistakes',
  'manage_strategic_plan', 'view_kpi', 'manage_documents',
  'manage_pre_registration', 'manage_enrollment', 'manage_academic_calendar'
);

-- Assistant supervisor
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'assistant_supervisor' AND p.name IN (
  'view_halaqat', 'view_students', 'view_recitations', 'view_attendance_log',
  'manage_madarij_tracks', 'manage_madarij_levels', 'manage_madarij_progress', 'manage_madarij_exams', 'manage_madarij_mistakes',
  'view_kpi', 'manage_documents',
  'manage_pre_registration', 'manage_enrollment', 'manage_academic_calendar'
);

-- Secretary
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'secretary' AND p.name IN (
  'view_halaqat', 'view_students', 'create_student', 'edit_student',
  'mark_attendance', 'edit_attendance', 'view_attendance_log',
  'manage_trips', 'manage_buses', 'manage_bulk_import',
  'manage_pre_registration', 'manage_enrollment', 'manage_academic_calendar'
);

-- Admin staff
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'admin_staff' AND p.name IN (
  'view_halaqat', 'view_students', 'create_student', 'edit_student',
  'mark_attendance', 'edit_attendance', 'view_attendance_log',
  'manage_trips', 'manage_buses', 'manage_bulk_import',
  'manage_pre_registration', 'manage_enrollment', 'manage_academic_calendar'
);

-- Teacher
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'teacher' AND p.name IN (
  'view_halaqat', 'view_students',
  'mark_attendance', 'view_attendance_log',
  'mark_recitation', 'edit_recitation', 'view_recitations',
  'manage_rankings', 'manage_trips',
  'manage_madarij_progress', 'manage_madarij_exams', 'manage_madarij_mistakes',
  'manage_academic_calendar', 'manage_buses'
);

-- Assistant teacher
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p
WHERE r.name = 'assistant_teacher' AND p.name IN (
  'view_halaqat', 'view_students',
  'mark_attendance', 'view_attendance_log',
  'mark_recitation', 'view_recitations',
  'manage_rankings', 'manage_academic_calendar'
);
