import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { MessageCircle, Search, Users, CheckCircle2 } from "lucide-react";
import { applyMessageVars, buildWhatsappLink, normalizeWhatsappNumber, MESSAGE_VARS } from "@/lib/whatsapp";

interface StudentRow {
  id: string;
  full_name: string;
  guardian_name: string | null;
  guardian_phone: string | null;
  halaqa_id: string | null;
  halaqat?: { name: string } | null;
}

const DEFAULT_TEMPLATE =
  "السلام عليكم {اسم_ولي_الأمر}\nبخصوص الطالب: {اسم_الطالب} — {الحلقة}\n\n";

/** إرسال جماعي عبر واتساب: يفتح محادثة جاهزة لكل ولي أمر بنقرة واحدة. */
const GuardianWhatsapp = () => {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [halaqat, setHalaqat] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [halaqaFilter, setHalaqaFilter] = useState("all");
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [sent, setSent] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const load = async () => {
      const [{ data: sts }, { data: hqs }] = await Promise.all([
        supabase
          .from("students")
          .select("id, full_name, guardian_name, guardian_phone, halaqa_id, halaqat(name)")
          .eq("status", "active")
          .order("full_name"),
        supabase.from("halaqat").select("id, name").eq("active", true).order("name"),
      ]);
      setStudents((sts as any) || []);
      setHalaqat((hqs as any) || []);
      setLoading(false);
    };
    load();
  }, []);

  const filtered = useMemo(
    () =>
      students.filter((s) => {
        if (halaqaFilter !== "all" && s.halaqa_id !== halaqaFilter) return false;
        if (!search.trim()) return true;
        const q = search.trim();
        return (
          s.full_name.includes(q) ||
          (s.guardian_name || "").includes(q) ||
          (s.guardian_phone || "").includes(q)
        );
      }),
    [students, halaqaFilter, search],
  );

  const messageFor = (s: StudentRow) =>
    applyMessageVars(template, {
      اسم_الطالب: s.full_name,
      الحلقة: s.halaqat?.name || "",
      اسم_ولي_الأمر: s.guardian_name || "",
    });

  const selectedRows = filtered.filter((s) => selected[s.id] && normalizeWhatsappNumber(s.guardian_phone));
  const withoutPhone = filtered.filter((s) => !normalizeWhatsappNumber(s.guardian_phone)).length;

  const toggleAll = (checked: boolean) => {
    const next = { ...selected };
    filtered.forEach((s) => {
      if (normalizeWhatsappNumber(s.guardian_phone)) next[s.id] = checked;
    });
    setSelected(next);
  };

  const openOne = (s: StudentRow) => {
    const link = buildWhatsappLink(s.guardian_phone, messageFor(s));
    if (!link) { toast.error("رقم غير صالح"); return; }
    window.open(link, "_blank", "noopener,noreferrer");
    setSent((p) => ({ ...p, [s.id]: true }));
  };

  /** المتصفحات تحجب فتح تبويبات متعددة دفعة واحدة، لذا نفتح واحدًا واحدًا بترتيب. */
  const openNextUnsent = () => {
    const next = selectedRows.find((s) => !sent[s.id]);
    if (!next) { toast.success("تم فتح جميع المحادثات المحددة"); return; }
    openOne(next);
  };

  const remaining = selectedRows.filter((s) => !sent[s.id]).length;

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <MessageCircle className="w-6 h-6 text-primary" />
          إرسال واتساب لأولياء الأمور
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          اختر الطلاب، اكتب نص الرسالة، ثم افتح المحادثات الجاهزة واحدة تلو الأخرى.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-lg">نص الرسالة</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Textarea rows={5} value={template} onChange={(e) => setTemplate(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            {MESSAGE_VARS.map((v) => (
              <Button
                key={v}
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setTemplate((t) => `${t}{${v}}`)}
              >
                {`{${v}}`}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center justify-between gap-2 flex-wrap">
            <span className="flex items-center gap-2"><Users className="w-5 h-5" /> الطلاب</span>
            <span className="flex items-center gap-2">
              <Badge variant="secondary">محدد: {selectedRows.length}</Badge>
              {withoutPhone > 0 && <Badge variant="outline">بدون رقم: {withoutPhone}</Badge>}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="بحث بالاسم أو الرقم..."
                className="pr-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={halaqaFilter} onValueChange={setHalaqaFilter}>
              <SelectTrigger className="w-full sm:w-56"><SelectValue placeholder="كل الحلقات" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الحلقات</SelectItem>
                {halaqat.map((h) => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-3 flex-wrap border-y py-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={selectedRows.length > 0 && selectedRows.length === filtered.filter((s) => normalizeWhatsappNumber(s.guardian_phone)).length}
                onCheckedChange={(c) => toggleAll(!!c)}
                aria-label="تحديد الكل"
              />
              تحديد الكل
            </label>
            <Button size="sm" disabled={remaining === 0} onClick={openNextUnsent}>
              <MessageCircle className="w-4 h-4 ml-1" />
              فتح المحادثة التالية ({remaining})
            </Button>
            {Object.keys(sent).length > 0 && (
              <Button size="sm" variant="ghost" onClick={() => setSent({})}>تصفير حالة الإرسال</Button>
            )}
          </div>

          {loading ? (
            <p className="text-center text-muted-foreground py-8">جارٍ التحميل...</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">لا يوجد طلاب مطابقون</p>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-auto">
              {filtered.map((s) => {
                const valid = !!normalizeWhatsappNumber(s.guardian_phone);
                return (
                  <div key={s.id} className="flex items-center gap-3 p-2 rounded border">
                    <Checkbox
                      checked={!!selected[s.id]}
                      disabled={!valid}
                      onCheckedChange={(c) => setSelected((p) => ({ ...p, [s.id]: !!c }))}
                      aria-label={`تحديد ${s.full_name}`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{s.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {s.halaqat?.name || "بدون حلقة"} — {s.guardian_name || "ولي أمر غير مسجّل"}
                        {s.guardian_phone && <span dir="ltr"> ({s.guardian_phone})</span>}
                      </p>
                    </div>
                    {sent[s.id] && <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />}
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!valid}
                      onClick={() => openOne(s)}
                      aria-label={`مراسلة ولي أمر ${s.full_name}`}
                    >
                      <MessageCircle className="w-4 h-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default GuardianWhatsapp;
