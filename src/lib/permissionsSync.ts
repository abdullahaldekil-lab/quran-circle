import { supabase } from "@/integrations/supabase/client";
import { PERMISSIONS_REGISTRY, type DefaultRole } from "@/lib/permissionsRegistry";

export interface SyncResult {
  added: string[];      // أسماء صلاحيات جديدة أُضيفت
  updated: string[];    // صلاحيات حُدِّث اسمها/فئتها
  linked: number;       // عدد ربط (دور ↔ صلاحية) جديد
  skipped: number;      // كانت موجودة وموزّعة بالفعل
  errors: string[];
}

/**
 * يُزامن جدول `permissions` و `role_permissions` مع السجل (Registry).
 * - يُضيف الصلاحيات الناقصة.
 * - يُحدّث `name_ar` / `category` إن تغيّرت.
 * - يربط الصلاحيات الجديدة فقط بالأدوار الافتراضية (لا يلمس الروابط القائمة).
 * - لا يحذف شيئًا من DB.
 *
 * يتطلب صلاحيات MANAGER (تفرضها RLS).
 */
export async function syncPermissionsRegistry(): Promise<SyncResult> {
  const result: SyncResult = { added: [], updated: [], linked: 0, skipped: 0, errors: [] };

  // 1) جلب الصلاحيات والأدوار الحالية
  const [{ data: existingPerms, error: pErr }, { data: rolesData, error: rErr }] = await Promise.all([
    supabase.from("permissions").select("id, name, name_ar, category"),
    supabase.from("roles").select("id, name"),
  ]);

  if (pErr) { result.errors.push(`جلب الصلاحيات: ${pErr.message}`); return result; }
  if (rErr) { result.errors.push(`جلب الأدوار: ${rErr.message}`); return result; }

  const permsByName = new Map((existingPerms || []).map((p) => [p.name, p]));
  const rolesByName = new Map((rolesData || []).map((r) => [r.name, r.id]));

  // 2) إضافة الصلاحيات الناقصة + تحديث الموجود
  const toInsert: Array<{ name: string; name_ar: string; category: string }> = [];
  const toUpdate: Array<{ id: string; name_ar: string; category: string; name: string }> = [];

  for (const def of PERMISSIONS_REGISTRY) {
    const existing = permsByName.get(def.name);
    if (!existing) {
      toInsert.push({ name: def.name, name_ar: def.name_ar, category: def.category });
    } else if (existing.name_ar !== def.name_ar || existing.category !== def.category) {
      toUpdate.push({ id: existing.id, name: def.name, name_ar: def.name_ar, category: def.category });
    }
  }

  if (toInsert.length > 0) {
    const { data: inserted, error } = await supabase
      .from("permissions")
      .insert(toInsert)
      .select("id, name");
    if (error) {
      result.errors.push(`إضافة صلاحيات: ${error.message}`);
    } else {
      (inserted || []).forEach((p) => {
        result.added.push(p.name);
        permsByName.set(p.name, { id: p.id, name: p.name, name_ar: "", category: "" } as any);
      });
    }
  }

  for (const u of toUpdate) {
    const { error } = await supabase
      .from("permissions")
      .update({ name_ar: u.name_ar, category: u.category })
      .eq("id", u.id);
    if (error) result.errors.push(`تحديث ${u.name}: ${error.message}`);
    else result.updated.push(u.name);
  }

  // 3) ربط الصلاحيات الجديدة فقط بالأدوار الافتراضية
  // (لا نلمس الصلاحيات القديمة لتفادي عكس تخصيص يدوي للمدير)
  if (result.added.length > 0) {
    // جلب الـ ids للصلاحيات الجديدة
    const { data: newPerms } = await supabase
      .from("permissions")
      .select("id, name")
      .in("name", result.added);

    const newPermIdByName = new Map((newPerms || []).map((p) => [p.name, p.id]));

    const links: Array<{ role_id: string; permission_id: string }> = [];
    for (const permName of result.added) {
      const def = PERMISSIONS_REGISTRY.find((d) => d.name === permName);
      const permId = newPermIdByName.get(permName);
      if (!def || !permId) continue;

      for (const roleName of def.defaultRoles as DefaultRole[]) {
        const roleId = rolesByName.get(roleName);
        if (!roleId) continue;
        links.push({ role_id: roleId, permission_id: permId });
      }
    }

    if (links.length > 0) {
      // upsert ضد UNIQUE(role_id, permission_id) لتجنب التكرار
      const { error, count } = await supabase
        .from("role_permissions")
        .upsert(links, { onConflict: "role_id,permission_id", ignoreDuplicates: true, count: "exact" });
      if (error) result.errors.push(`ربط الأدوار: ${error.message}`);
      else result.linked = count ?? links.length;
    }
  } else {
    result.skipped = PERMISSIONS_REGISTRY.length;
  }

  return result;
}
