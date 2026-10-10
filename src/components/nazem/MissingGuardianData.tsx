import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserX, Save } from "lucide-react";
import { toast } from "sonner";

const FIELDS = [
  { key: "guardian_name", label: "اسم ولي الأمر" },
  { key: "guardian_phone", label: "جوال ولي الأمر" },
  { key: "guardian_work", label: "عمل ولي الأمر" },
] as const;

type Row = { id: string; full_name: string; guardian_name: string | null; guardian_phone: string | null; guardian_work: string | null };

const MissingGuardianData = ({ halaqaId }: { halaqaId: string }) => {
  const [rows, setRows] = useState<Row[]>([]);
  const [edits, setEdits] = useState<Record<string, Partial<Row>>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    let q = supabase.from("students")
      .select("id, full_name, guardian_name, guardian_phone, guardian_work")
      .in("status", ["active", "inactive"])
      .or("guardian_work.is.null,guardian_work.eq.,guardian_name.is.null,guardian_name.eq.,guardian_phone.is.null,guardian_phone.eq.")
      .order("full_name").limit(500);
    if (halaqaId !== "all") q = q.eq("halaqa_id", halaqaId);
    const { data } = await q;
    setRows((data as Row[]) || []);
  }, [halaqaId]);

  useEffect(() => { load(); }, [load]);

  const save = async (r: Row) => {
    const e = edits[r.id];
    if (!e) return;
    const patch: Record<string, string | null> = {};
    FIELDS.forEach(({ key }) => { if (key in e) patch[key] = (e[key] as string)?.trim() || null; });
    setSaving(r.id);
    const { error } = await supabase.from("students").update(patch).eq("id", r.id);
    setSaving(null);
    if (error) return toast.error(error.message || "تعذر الحفظ");
    toast.success("تم حفظ بيانات ولي الأمر");
    setEdits((p) => { const n = { ...p }; delete n[r.id]; return n; });
    load();
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <UserX className="w-4 h-4 text-destructive" />
          طلاب بيانات ولي الأمر ناقصة
          <Badge variant="secondary">{rows.length}</Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">املأ الخانات الفارغة ثم احفظ، وتظهر البيانات مباشرة في ملف ناظم.</p>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-3">جميع الطلاب لديهم بيانات ولي أمر مكتملة.</p>
        ) : (
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {rows.map((r) => {
              const e = edits[r.id] || {};
              return (
                <div key={r.id} className="border rounded-lg p-3 space-y-2">
                  <Link to={`/students/${r.id}`} className="font-medium text-primary hover:underline">{r.full_name}</Link>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {FIELDS.map(({ key, label }) => (
                      <Input key={key} placeholder={label}
                        className={!r[key] ? "border-destructive/50" : ""}
                        value={(key in e ? e[key] : r[key]) ?? ""}
                        onChange={(ev) => setEdits((p) => ({ ...p, [r.id]: { ...p[r.id], [key]: ev.target.value } }))} />
                    ))}
                  </div>
                  {edits[r.id] && (
                    <Button size="sm" onClick={() => save(r)} disabled={saving === r.id}>
                      <Save className="w-4 h-4 ml-1" />{saving === r.id ? "جارٍ الحفظ..." : "حفظ"}
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default MissingGuardianData;
