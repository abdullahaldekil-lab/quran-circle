import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { CalendarDays, Plus, Trash2, Pencil } from "lucide-react";
import { useRole } from "@/hooks/useRole";
import { useAuth } from "@/hooks/useAuth";

interface Holiday {
  id: string;
  title: string;
  start_date: string;
  end_date: string;
  holiday_type: string;
  created_at: string;
}

const AcademicCalendar = () => {
  const { isManager } = useRole();
  const { user } = useAuth();
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", start_date: "", end_date: "", holiday_type: "official" });

  const fetchHolidays = async () => {
    const { data } = await supabase.from("holidays").select("*").order("start_date", { ascending: true });
    setHolidays((data as Holiday[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchHolidays(); }, []);

  const resetForm = () => {
    setForm({ title: "", start_date: "", end_date: "", holiday_type: "official" });
    setEditingId(null);
  };

  const handleSave = async () => {
    if (!form.title || !form.start_date || !form.end_date) {
      toast.error("يرجى تعبئة جميع الحقول");
      return;
    }

    if (editingId) {
      const { error } = await supabase.from("holidays").update({
        title: form.title, start_date: form.start_date, end_date: form.end_date, holiday_type: form.holiday_type,
      }).eq("id", editingId);
      if (error) { toast.error("خطأ في التحديث"); return; }
      toast.success("تم تحديث الإجازة");
    } else {
      const { error } = await supabase.from("holidays").insert({
        title: form.title, start_date: form.start_date, end_date: form.end_date,
        holiday_type: form.holiday_type, created_by: user?.id,
      });
      if (error) { toast.error("خطأ في الإضافة"); return; }
      toast.success("تمت إضافة الإجازة");
    }
    resetForm();
    setDialogOpen(false);
    fetchHolidays();
  };

  const handleEdit = (h: Holiday) => {
    setForm({ title: h.title, start_date: h.start_date, end_date: h.end_date, holiday_type: h.holiday_type });
    setEditingId(h.id);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("holidays").delete().eq("id", id);
    if (error) { toast.error("خطأ في الحذف"); return; }
    toast.success("تم حذف الإجازة");
    fetchHolidays();
  };

  const today = new Date().toISOString().split("T")[0];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">التقويم الأكاديمي</h1>
          <p className="text-muted-foreground text-sm">إدارة الإجازات الرسمية والمخصصة</p>
        </div>
        {isManager && (
          <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) resetForm(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 ml-2" />إضافة إجازة</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingId ? "تعديل الإجازة" : "إضافة إجازة جديدة"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-1">
                  <Label>اسم الإجازة</Label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="مثال: عيد الفطر" />
                </div>
                <div className="space-y-1">
                  <Label>النوع</Label>
                  <Select value={form.holiday_type} onValueChange={(v) => setForm({ ...form, holiday_type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="official">رسمية</SelectItem>
                      <SelectItem value="custom">مخصصة</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label>تاريخ البداية</Label>
                    <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
                  </div>
                  <div className="space-y-1">
                    <Label>تاريخ النهاية</Label>
                    <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
                  </div>
                </div>
                <Button onClick={handleSave} className="w-full">{editingId ? "تحديث" : "إضافة"}</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Active/Upcoming */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-primary" />
            الإجازات
          </CardTitle>
        </CardHeader>
        <CardContent>
          {holidays.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">لا توجد إجازات مسجلة</p>
          ) : (
            <div className="space-y-3">
              {holidays.map((h) => {
                const isPast = h.end_date < today;
                const isActive = h.start_date <= today && h.end_date >= today;
                const isFuture = h.start_date > today;
                return (
                  <div key={h.id} className={`flex items-center justify-between p-3 rounded-lg border ${isActive ? "border-primary bg-primary/5" : isPast ? "opacity-60" : ""}`}>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{h.title}</span>
                        <Badge variant={h.holiday_type === "official" ? "default" : "secondary"} className="text-xs">
                          {h.holiday_type === "official" ? "رسمية" : "مخصصة"}
                        </Badge>
                        {isActive && <Badge className="bg-green-100 text-green-800 text-xs">جارية</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {new Date(h.start_date).toLocaleDateString("ar-SA")} – {new Date(h.end_date).toLocaleDateString("ar-SA")}
                      </p>
                    </div>
                    {isManager && isFuture && (
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(h)}>
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(h.id)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    )}
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

export default AcademicCalendar;
