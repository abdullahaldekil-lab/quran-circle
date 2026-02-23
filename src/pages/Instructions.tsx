import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { sendNotification } from "@/utils/sendNotification";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, MessageSquare } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type InstructionStatus = Database["public"]["Enums"]["instruction_status"];

const statusLabels: Record<InstructionStatus, string> = {
  new: "جديد",
  in_progress: "قيد التنفيذ",
  completed: "مكتمل",
};

const statusColors: Record<InstructionStatus, string> = {
  new: "bg-info/10 text-info",
  in_progress: "bg-warning/10 text-warning",
  completed: "bg-success/10 text-success",
};

const Instructions = () => {
  const { user, profile } = useAuth();
  const [instructions, setInstructions] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: "", body: "", to_teacher_id: "", priority: "normal" });

  const isManager = profile?.role === "manager" || profile?.role === "supervisor";

  const fetchData = async () => {
    const { data } = await supabase
      .from("instructions")
      .select("*, from_profile:from_manager_id(full_name), to_profile:to_teacher_id(full_name)")
      .order("created_at", { ascending: false });
    setInstructions(data || []);

    const { data: teacherData } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("role", ["teacher", "assistant_teacher"]);
    setTeachers(teacherData || []);
  };

  useEffect(() => { fetchData(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("instructions").insert({
      from_manager_id: user!.id,
      to_teacher_id: form.to_teacher_id || null,
      title: form.title,
      body: form.body || null,
      priority: form.priority,
    });
    if (error) { toast.error("حدث خطأ"); return; }

    // Send notification to the assigned teacher
    if (form.to_teacher_id) {
      sendNotification({
        templateCode: "NEW_INSTRUCTION",
        recipientIds: [form.to_teacher_id],
        variables: { title: form.title, managerName: user?.user_metadata?.full_name || "المدير" },
      }).catch(console.error);
    }

    toast.success("تم إرسال التعليمات");
    setDialogOpen(false);
    setForm({ title: "", body: "", to_teacher_id: "", priority: "normal" });
    fetchData();
  };

  const updateStatus = async (id: string, status: InstructionStatus) => {
    await supabase.from("instructions").update({ status }).eq("id", id);
    fetchData();
    toast.success("تم تحديث الحالة");
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">التعليمات</h1>
          <p className="text-muted-foreground text-sm">أوامر وتعليمات المدير</p>
        </div>
        {isManager && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 ml-2" />تعليمات جديدة</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>إضافة تعليمات</DialogTitle></DialogHeader>
              <form onSubmit={handleAdd} className="space-y-4">
                <div className="space-y-2">
                  <Label>العنوان</Label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>التفاصيل</Label>
                  <Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={3} />
                </div>
                <div className="space-y-2">
                  <Label>موجّه إلى</Label>
                  <Select value={form.to_teacher_id} onValueChange={(v) => setForm({ ...form, to_teacher_id: v })}>
                    <SelectTrigger><SelectValue placeholder="الكل" /></SelectTrigger>
                    <SelectContent>
                      {teachers.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>الأولوية</Label>
                  <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">منخفضة</SelectItem>
                      <SelectItem value="normal">عادية</SelectItem>
                      <SelectItem value="high">عالية</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full">إرسال</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="space-y-4">
        {instructions.map((inst) => (
          <Card key={inst.id} className="animate-slide-in">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-primary" />
                  <CardTitle className="text-base">{inst.title}</CardTitle>
                </div>
                <Badge className={statusColors[inst.status as InstructionStatus]}>
                  {statusLabels[inst.status as InstructionStatus]}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {inst.body && <p className="text-sm text-muted-foreground">{inst.body}</p>}
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>من: {inst.from_profile?.full_name}</span>
                <span>إلى: {inst.to_profile?.full_name || "الكل"}</span>
              </div>
              {inst.status !== "completed" && (
                <div className="flex gap-2">
                  {inst.status === "new" && (
                    <Button size="sm" variant="outline" onClick={() => updateStatus(inst.id, "in_progress")}>
                      بدء التنفيذ
                    </Button>
                  )}
                  <Button size="sm" onClick={() => updateStatus(inst.id, "completed")}>
                    تم التنفيذ
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {instructions.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>لا توجد تعليمات</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Instructions;
