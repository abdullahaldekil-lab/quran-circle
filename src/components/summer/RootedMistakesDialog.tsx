import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Check, RotateCcw } from "lucide-react";

interface RootedMistake {
  id: string;
  surah: string;
  ayah_number: string | null;
  mistake_type: string;
  correction: string | null;
  resolved: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  summerStudentId: string;
  studentName: string;
}

const empty = { surah: "", ayah_number: "", mistake_type: "خطأ", correction: "" };

export default function RootedMistakesDialog({ open, onOpenChange, summerStudentId, studentName }: Props) {
  const [rows, setRows] = useState<RootedMistake[]>([]);
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("summer_rooted_mistakes")
      .select("*")
      .eq("summer_student_id", summerStudentId)
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) return toast.error(error.message);
    setRows((data as any) || []);
  };

  useEffect(() => { if (open && summerStudentId) { setForm(empty); load(); } }, [open, summerStudentId]);

  const add = async () => {
    if (!form.surah.trim()) return toast.error("أدخل اسم السورة");
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("summer_rooted_mistakes").insert({
      summer_student_id: summerStudentId,
      surah: form.surah.trim(),
      ayah_number: form.ayah_number || null,
      mistake_type: form.mistake_type,
      correction: form.correction || null,
      created_by: userData.user?.id || null,
    });
    if (error) return toast.error(error.message);
    setForm(empty);
    toast.success("تمت إضافة الخطأ المتأصل");
    load();
  };

  const toggleResolved = async (r: RootedMistake) => {
    const { error } = await supabase.from("summer_rooted_mistakes").update({ resolved: !r.resolved }).eq("id", r.id);
    if (error) return toast.error(error.message);
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("summer_rooted_mistakes").delete().eq("id", id);
    if (error) return toast.error(error.message);
    load();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>الأخطاء المتأصلة — {studentName}</DialogTitle></DialogHeader>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 items-end border rounded-lg p-3 bg-muted/30">
          <div><Label className="text-xs">السورة</Label><Input value={form.surah} onChange={(e) => setForm({ ...form, surah: e.target.value })} /></div>
          <div><Label className="text-xs">رقم الآية</Label><Input value={form.ayah_number} onChange={(e) => setForm({ ...form, ayah_number: e.target.value })} /></div>
          <div>
            <Label className="text-xs">خ / ل</Label>
            <Select value={form.mistake_type} onValueChange={(v) => setForm({ ...form, mistake_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="خطأ">خطأ</SelectItem>
                <SelectItem value="لحن">لحن</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs">التصويب</Label><Input value={form.correction} onChange={(e) => setForm({ ...form, correction: e.target.value })} /></div>
          <div className="col-span-2 md:col-span-4">
            <Button size="sm" onClick={add}><Plus className="w-4 h-4 ml-1" />إضافة</Button>
          </div>
        </div>

        <div className="border rounded-lg overflow-x-auto mt-3">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="p-2 text-right">السورة</th>
                <th className="p-2 text-right">رقم الآية</th>
                <th className="p-2 text-right">خ / ل</th>
                <th className="p-2 text-right">التصويب</th>
                <th className="p-2 text-right">الحالة</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-2">{r.surah}</td>
                  <td className="p-2">{r.ayah_number || "—"}</td>
                  <td className="p-2">{r.mistake_type}</td>
                  <td className="p-2">{r.correction || "—"}</td>
                  <td className="p-2">
                    <Badge variant={r.resolved ? "outline" : "secondary"} className={r.resolved ? "border-green-500 text-green-700 dark:text-green-400" : ""}>
                      {r.resolved ? "مُعالَج" : "قائم"}
                    </Badge>
                  </td>
                  <td className="p-2 flex gap-1 justify-end">
                    <Button size="icon" variant="ghost" aria-label={r.resolved ? "إرجاع كخطأ قائم" : "تعليم كمُعالَج"} onClick={() => toggleResolved(r)}>
                      {r.resolved ? <RotateCcw className="w-4 h-4" /> : <Check className="w-4 h-4 text-green-600" />}
                    </Button>
                    <Button size="icon" variant="ghost" aria-label="حذف الخطأ" onClick={() => remove(r.id)}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">{loading ? "جارٍ التحميل..." : "لا توجد أخطاء متأصلة مسجلة."}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
