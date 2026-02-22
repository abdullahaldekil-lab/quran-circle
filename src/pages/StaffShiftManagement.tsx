import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Plus, Edit, Clock } from "lucide-react";

interface Shift {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  grace_in_minutes: number;
  grace_out_minutes: number;
  active: boolean;
}

const StaffShiftManagement = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [form, setForm] = useState({
    name: "",
    start_time: "08:00",
    end_time: "16:00",
    grace_in_minutes: 10,
    grace_out_minutes: 10,
  });

  const { data: shifts = [], isLoading } = useQuery({
    queryKey: ["staff-shifts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("staff_attendance_shifts")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Shift[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: typeof form & { id?: string }) => {
      if (values.id) {
        const { error } = await supabase
          .from("staff_attendance_shifts")
          .update({
            name: values.name,
            start_time: values.start_time,
            end_time: values.end_time,
            grace_in_minutes: values.grace_in_minutes,
            grace_out_minutes: values.grace_out_minutes,
          })
          .eq("id", values.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("staff_attendance_shifts")
          .insert({
            name: values.name,
            start_time: values.start_time,
            end_time: values.end_time,
            grace_in_minutes: values.grace_in_minutes,
            grace_out_minutes: values.grace_out_minutes,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-shifts"] });
      toast({ title: "تم الحفظ بنجاح" });
      setDialogOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from("staff_attendance_shifts")
        .update({ active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-shifts"] });
    },
  });

  const resetForm = () => {
    setForm({ name: "", start_time: "08:00", end_time: "16:00", grace_in_minutes: 10, grace_out_minutes: 10 });
    setEditingShift(null);
  };

  const openEdit = (shift: Shift) => {
    setEditingShift(shift);
    setForm({
      name: shift.name,
      start_time: shift.start_time.slice(0, 5),
      end_time: shift.end_time.slice(0, 5),
      grace_in_minutes: shift.grace_in_minutes,
      grace_out_minutes: shift.grace_out_minutes,
    });
    setDialogOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate({ ...form, id: editingShift?.id });
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">جداول الدوام</h1>
          <p className="text-muted-foreground">إدارة فترات الدوام ودقائق السماح</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 ml-2" />إضافة دوام</Button>
          </DialogTrigger>
          <DialogContent dir="rtl">
            <DialogHeader>
              <DialogTitle>{editingShift ? "تعديل الدوام" : "إضافة دوام جديد"}</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>اسم الدوام</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required placeholder="مثال: دوام صباحي" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>وقت البداية</Label>
                  <Input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} required />
                </div>
                <div>
                  <Label>وقت النهاية</Label>
                  <Input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>سماح التأخير (دقائق)</Label>
                  <Input type="number" min={0} value={form.grace_in_minutes} onChange={(e) => setForm({ ...form, grace_in_minutes: parseInt(e.target.value) || 0 })} />
                </div>
                <div>
                  <Label>سماح الخروج المبكر (دقائق)</Label>
                  <Input type="number" min={0} value={form.grace_out_minutes} onChange={(e) => setForm({ ...form, grace_out_minutes: parseInt(e.target.value) || 0 })} />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "جارٍ الحفظ..." : "حفظ"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Clock className="w-5 h-5" />فترات الدوام</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">جارٍ التحميل...</p>
          ) : shifts.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">لا توجد فترات دوام. أضف فترة جديدة.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">الاسم</TableHead>
                  <TableHead className="text-right">البداية</TableHead>
                  <TableHead className="text-right">النهاية</TableHead>
                  <TableHead className="text-right">سماح التأخير</TableHead>
                  <TableHead className="text-right">سماح الخروج</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shifts.map((shift) => (
                  <TableRow key={shift.id}>
                    <TableCell className="font-medium">{shift.name}</TableCell>
                    <TableCell>{shift.start_time.slice(0, 5)}</TableCell>
                    <TableCell>{shift.end_time.slice(0, 5)}</TableCell>
                    <TableCell>{shift.grace_in_minutes} د</TableCell>
                    <TableCell>{shift.grace_out_minutes} د</TableCell>
                    <TableCell>
                      <Switch
                        checked={shift.active}
                        onCheckedChange={(checked) => toggleMutation.mutate({ id: shift.id, active: checked })}
                      />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => openEdit(shift)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default StaffShiftManagement;
