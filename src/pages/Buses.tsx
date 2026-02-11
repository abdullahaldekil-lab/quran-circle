import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { Plus, Bus, Users, UserMinus, Trash2, UserPlus } from "lucide-react";
import { Progress } from "@/components/ui/progress";

const Buses = () => {
  const { isManager, isAdminStaff, canWrite } = useRole();
  const canManage = isManager || isAdminStaff;
  const queryClient = useQueryClient();
  const [busDialogOpen, setBusDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedBusId, setSelectedBusId] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [busForm, setBusForm] = useState({ bus_name: "", driver_name: "", driver_phone: "", capacity: 30 });

  // Fetch buses
  const { data: buses = [] } = useQuery({
    queryKey: ["buses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("buses").select("*").eq("active", true).order("bus_name");
      if (error) throw error;
      return data;
    },
  });

  // Fetch assignments with student names
  const { data: assignments = [] } = useQuery({
    queryKey: ["bus_assignments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("student_bus_assignments")
        .select("*, students(full_name, halaqa_id)")
        .eq("active", true);
      if (error) throw error;
      return data;
    },
  });

  // Fetch all active students for assignment
  const { data: allStudents = [] } = useQuery({
    queryKey: ["students_for_bus"],
    queryFn: async () => {
      const { data, error } = await supabase.from("students").select("id, full_name").eq("status", "active").order("full_name");
      if (error) throw error;
      return data;
    },
    enabled: canManage,
  });

  const assignedStudentIds = new Set(assignments.map((a: any) => a.student_id));
  const unassignedStudents = allStudents.filter((s: any) => !assignedStudentIds.has(s.id));

  const getAssignmentsForBus = (busId: string) => assignments.filter((a: any) => a.bus_id === busId);

  const getCapacityStatus = (busId: string, capacity: number) => {
    const count = getAssignmentsForBus(busId).length;
    if (count > capacity) return { label: "تجاوز السعة", color: "destructive" as const, percent: (count / capacity) * 100 };
    if (count === capacity) return { label: "مكتمل", color: "default" as const, percent: 100 };
    return { label: "ناقص", color: "secondary" as const, percent: (count / capacity) * 100 };
  };

  // Mutations
  const addBusMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("buses").insert(busForm);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["buses"] });
      toast({ title: "تمت إضافة الباص" });
      setBusForm({ bus_name: "", driver_name: "", driver_phone: "", capacity: 30 });
      setBusDialogOpen(false);
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const deleteBusMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("buses").update({ active: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["buses"] });
      toast({ title: "تم حذف الباص" });
    },
  });

  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!selectedBusId || !selectedStudentId) return;
      const bus = buses.find((b: any) => b.id === selectedBusId);
      const currentCount = getAssignmentsForBus(selectedBusId).length;
      if (bus && currentCount >= bus.capacity) {
        throw new Error("السعة ممتلئة، لا يمكن إضافة طالب");
      }
      const { error } = await supabase.from("student_bus_assignments").insert({
        student_id: selectedStudentId,
        bus_id: selectedBusId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bus_assignments"] });
      toast({ title: "تم تعيين الطالب" });
      setSelectedStudentId("");
      setAssignDialogOpen(false);
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const unassignMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("student_bus_assignments").update({ active: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bus_assignments"] });
      toast({ title: "تم إلغاء التعيين" });
    },
  });

  // Dashboard stats
  const totalAssigned = assignments.length;
  const totalStudents = allStudents.length;
  const unassignedCount = totalStudents - totalAssigned;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">إدارة الباصات</h1>
          <p className="text-muted-foreground">تتبع الباصات وتعيين الطلاب</p>
        </div>
        {canManage && (
          <Dialog open={busDialogOpen} onOpenChange={setBusDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 ml-2" />إضافة باص</Button>
            </DialogTrigger>
            <DialogContent dir="rtl">
              <DialogHeader><DialogTitle>إضافة باص جديد</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div><Label>اسم الباص</Label><Input value={busForm.bus_name} onChange={e => setBusForm(f => ({ ...f, bus_name: e.target.value }))} placeholder="مثال: باص 1" /></div>
                <div><Label>اسم السائق</Label><Input value={busForm.driver_name} onChange={e => setBusForm(f => ({ ...f, driver_name: e.target.value }))} /></div>
                <div><Label>هاتف السائق</Label><Input value={busForm.driver_phone} onChange={e => setBusForm(f => ({ ...f, driver_phone: e.target.value }))} /></div>
                <div><Label>السعة</Label><Input type="number" value={busForm.capacity} onChange={e => setBusForm(f => ({ ...f, capacity: parseInt(e.target.value) || 30 }))} /></div>
                <Button className="w-full" onClick={() => addBusMutation.mutate()} disabled={!busForm.bus_name || addBusMutation.isPending}>
                  {addBusMutation.isPending ? "جارٍ الإضافة..." : "إضافة"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Dashboard Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">عدد الباصات</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{buses.length}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">طلاب معيّنون</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{totalAssigned}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">بدون باص</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold text-destructive">{unassignedCount > 0 ? unassignedCount : 0}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">نسبة التعيين</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{totalStudents > 0 ? Math.round((totalAssigned / totalStudents) * 100) : 0}%</p></CardContent></Card>
      </div>

      {/* Buses list */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {buses.map((bus: any) => {
          const busAssignments = getAssignmentsForBus(bus.id);
          const status = getCapacityStatus(bus.id, bus.capacity);
          return (
            <Card key={bus.id}>
              <CardHeader className="flex flex-row items-start justify-between pb-2">
                <div className="flex items-center gap-2">
                  <Bus className="w-5 h-5 text-primary" />
                  <CardTitle className="text-base">{bus.bus_name}</CardTitle>
                </div>
                <div className="flex gap-1">
                  {canManage && (
                    <>
                      <Button variant="ghost" size="icon" onClick={() => { setSelectedBusId(bus.id); setAssignDialogOpen(true); }}>
                        <UserPlus className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => deleteBusMutation.mutate(bus.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {bus.driver_name && <p className="text-sm text-muted-foreground">السائق: {bus.driver_name} {bus.driver_phone && `| ${bus.driver_phone}`}</p>}
                <div className="flex items-center gap-2">
                  <Badge variant={status.color}>{status.label}</Badge>
                  <span className="text-sm text-muted-foreground">{busAssignments.length}/{bus.capacity}</span>
                </div>
                <Progress value={Math.min(status.percent, 100)} className="h-2" />
                {busAssignments.length > 0 && (
                  <Table>
                    <TableHeader><TableRow><TableHead>الطالب</TableHead>{canManage && <TableHead className="w-10"></TableHead>}</TableRow></TableHeader>
                    <TableBody>
                      {busAssignments.map((a: any) => (
                        <TableRow key={a.id}>
                          <TableCell className="text-sm">{a.students?.full_name}</TableCell>
                          {canManage && (
                            <TableCell>
                              <Button variant="ghost" size="icon" onClick={() => unassignMutation.mutate(a.id)}>
                                <UserMinus className="w-4 h-4 text-destructive" />
                              </Button>
                            </TableCell>
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Assign Student Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>تعيين طالب للباص</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>الباص</Label>
              <Select value={selectedBusId || ""} onValueChange={setSelectedBusId}>
                <SelectTrigger><SelectValue placeholder="اختر الباص" /></SelectTrigger>
                <SelectContent>{buses.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.bus_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>الطالب</Label>
              <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                <SelectTrigger><SelectValue placeholder="اختر الطالب" /></SelectTrigger>
                <SelectContent>{unassignedStudents.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {selectedBusId && (() => {
              const bus = buses.find((b: any) => b.id === selectedBusId);
              const count = getAssignmentsForBus(selectedBusId).length;
              if (bus && count >= bus.capacity) return <p className="text-sm text-destructive font-medium">⚠️ السعة ممتلئة</p>;
              return null;
            })()}
            <Button className="w-full" onClick={() => assignMutation.mutate()} disabled={!selectedBusId || !selectedStudentId || assignMutation.isPending}>
              {assignMutation.isPending ? "جارٍ التعيين..." : "تعيين"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Buses;
