import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Target, Plus, ChevronDown, ChevronUp, Calendar, AlertTriangle,
  CheckCircle, Clock, TrendingUp, ListChecks, Edit, Trash2, Flag
} from "lucide-react";
import { formatDateHijriOnly } from "@/lib/hijri";

const AXES = [
  { value: "memorization_quality", label: "الحفظ والجودة" },
  { value: "teachers_development", label: "المعلمون والتطوير" },
  { value: "students_motivation", label: "الطلاب والتحفيز" },
  { value: "admin_governance", label: "الإدارة والحوكمة" },
  { value: "sustainability_growth", label: "الاستدامة والنمو" },
];

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  not_started: { label: "لم يبدأ", color: "bg-muted text-muted-foreground" },
  in_progress: { label: "قيد التنفيذ", color: "bg-primary/10 text-primary" },
  completed: { label: "مكتمل", color: "bg-green-100 text-green-800" },
  delayed: { label: "متأخر", color: "bg-destructive/10 text-destructive" },
};

const PRIORITY_MAP: Record<string, { label: string; color: string }> = {
  low: { label: "منخفض", color: "bg-muted text-muted-foreground" },
  medium: { label: "متوسط", color: "bg-yellow-100 text-yellow-800" },
  high: { label: "عالي", color: "bg-destructive/10 text-destructive" },
};

interface Goal {
  id: string; title: string; description: string | null; axis: string;
  start_date: string; end_date: string; status: string; progress_percentage: number;
  is_activated: boolean; created_at: string;
}
interface Objective {
  id: string; goal_id: string; title: string; description: string | null;
  start_date: string; end_date: string; status: string; progress_percentage: number; created_at: string;
}
interface Task {
  id: string; objective_id: string; title: string; description: string | null;
  responsible_role: string; assigned_to: string | null; start_date: string;
  end_date: string; priority: string; status: string; notes: string | null;
  completed_at: string | null; created_at: string;
}

const StrategicPlan = () => {
  const { profile, user } = useAuth();
  const { toast } = useToast();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [objectives, setObjectives] = useState<Objective[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedGoal, setExpandedGoal] = useState<string | null>(null);
  const [expandedObjective, setExpandedObjective] = useState<string | null>(null);
  const [goalDialog, setGoalDialog] = useState(false);
  const [objectiveDialog, setObjectiveDialog] = useState(false);
  const [taskDialog, setTaskDialog] = useState(false);
  const [selectedGoalId, setSelectedGoalId] = useState<string>("");
  const [selectedObjectiveId, setSelectedObjectiveId] = useState<string>("");
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null);
  const [editingObjective, setEditingObjective] = useState<Objective | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [profiles, setProfiles] = useState<any[]>([]);

  const role = profile?.role;
  const isManager = role === "manager";
  const isSupervisor = role === "supervisor" || role === "assistant_supervisor";
  const canManageGoals = isManager;
  const canManageTasks = isManager || isSupervisor;

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [g, o, t, p] = await Promise.all([
      supabase.from("strategic_goals").select("*").order("created_at", { ascending: false }),
      supabase.from("strategic_objectives").select("*").order("created_at", { ascending: false }),
      supabase.from("strategic_tasks").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("id, full_name, role"),
    ]);
    if (g.data) setGoals(g.data as Goal[]);
    if (o.data) setObjectives(o.data as Objective[]);
    if (t.data) setTasks(t.data as Task[]);
    if (p.data) setProfiles(p.data);
    setLoading(false);
  };

  const logChange = async (entityType: string, entityId: string, action: string, details?: string) => {
    await supabase.from("strategic_change_log").insert({
      entity_type: entityType, entity_id: entityId, action, details, performed_by: user?.id,
    });
  };

  // === Goal CRUD ===
  const handleSaveGoal = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const data = {
      title: form.get("title") as string,
      description: form.get("description") as string,
      axis: form.get("axis") as string,
      start_date: form.get("start_date") as string,
      end_date: form.get("end_date") as string,
    };
    if (editingGoal) {
      if (editingGoal.is_activated && !isManager) {
        toast({ title: "لا يمكن تعديل هدف مفعّل", variant: "destructive" }); return;
      }
      const { error } = await supabase.from("strategic_goals").update(data).eq("id", editingGoal.id);
      if (!error) { await logChange("goal", editingGoal.id, "update", `تعديل: ${data.title}`); }
      if (error) { toast({ title: "خطأ", description: error.message, variant: "destructive" }); return; }
    } else {
      const { data: inserted, error } = await supabase.from("strategic_goals").insert({ ...data, created_by: user?.id }).select().single();
      if (error) { toast({ title: "خطأ", description: error.message, variant: "destructive" }); return; }
      if (inserted) await logChange("goal", inserted.id, "create", `إنشاء: ${data.title}`);
    }
    setGoalDialog(false); setEditingGoal(null); fetchAll();
    toast({ title: editingGoal ? "تم تحديث الهدف" : "تم إنشاء الهدف" });
  };

  const handleDeleteGoal = async (goal: Goal) => {
    if (goal.is_activated) { toast({ title: "لا يمكن حذف هدف مفعّل", variant: "destructive" }); return; }
    const { error } = await supabase.from("strategic_goals").delete().eq("id", goal.id);
    if (!error) { await logChange("goal", goal.id, "delete", `حذف: ${goal.title}`); fetchAll(); toast({ title: "تم حذف الهدف" }); }
  };

  const handleActivateGoal = async (goal: Goal) => {
    await supabase.from("strategic_goals").update({ is_activated: true, status: "in_progress" }).eq("id", goal.id);
    await logChange("goal", goal.id, "activate", `تفعيل: ${goal.title}`);
    fetchAll(); toast({ title: "تم تفعيل الهدف" });
  };

  const handleUpdateGoalProgress = async (goalId: string, progress: number) => {
    const status = progress >= 100 ? "completed" : progress > 0 ? "in_progress" : "not_started";
    await supabase.from("strategic_goals").update({ progress_percentage: progress, status }).eq("id", goalId);
    fetchAll();
  };

  // === Objective CRUD ===
  const handleSaveObjective = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const data = {
      goal_id: selectedGoalId,
      title: form.get("title") as string,
      description: form.get("description") as string,
      start_date: form.get("start_date") as string,
      end_date: form.get("end_date") as string,
    };
    if (editingObjective) {
      const { error } = await supabase.from("strategic_objectives").update(data).eq("id", editingObjective.id);
      if (error) { toast({ title: "خطأ", description: error.message, variant: "destructive" }); return; }
      await logChange("objective", editingObjective.id, "update", `تعديل: ${data.title}`);
    } else {
      const { data: inserted, error } = await supabase.from("strategic_objectives").insert({ ...data, created_by: user?.id }).select().single();
      if (error) { toast({ title: "خطأ", description: error.message, variant: "destructive" }); return; }
      if (inserted) await logChange("objective", inserted.id, "create", `إنشاء: ${data.title}`);
    }
    setObjectiveDialog(false); setEditingObjective(null); fetchAll();
    toast({ title: editingObjective ? "تم تحديث الهدف الفرعي" : "تم إنشاء الهدف الفرعي" });
  };

  const handleDeleteObjective = async (obj: Objective) => {
    const { error } = await supabase.from("strategic_objectives").delete().eq("id", obj.id);
    if (!error) { await logChange("objective", obj.id, "delete", `حذف: ${obj.title}`); fetchAll(); toast({ title: "تم حذف الهدف الفرعي" }); }
  };

  // === Task CRUD ===
  const handleSaveTask = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const data = {
      objective_id: selectedObjectiveId,
      title: form.get("title") as string,
      description: form.get("description") as string,
      responsible_role: form.get("responsible_role") as string,
      assigned_to: (form.get("assigned_to") as string) || null,
      start_date: form.get("start_date") as string,
      end_date: form.get("end_date") as string,
      priority: form.get("priority") as string,
      notes: form.get("notes") as string || null,
    };
    if (editingTask) {
      if (editingTask.status === "completed") { toast({ title: "لا يمكن تعديل مهمة مكتملة", variant: "destructive" }); return; }
      const { error } = await supabase.from("strategic_tasks").update(data).eq("id", editingTask.id);
      if (error) { toast({ title: "خطأ", description: error.message, variant: "destructive" }); return; }
      await logChange("task", editingTask.id, "update", `تعديل: ${data.title}`);
    } else {
      const { data: inserted, error } = await supabase.from("strategic_tasks").insert({ ...data, created_by: user?.id }).select().single();
      if (error) { toast({ title: "خطأ", description: error.message, variant: "destructive" }); return; }
      if (inserted) await logChange("task", inserted.id, "create", `إنشاء: ${data.title}`);
    }
    setTaskDialog(false); setEditingTask(null); fetchAll();
    toast({ title: editingTask ? "تم تحديث المهمة" : "تم إنشاء المهمة" });
  };

  const handleUpdateTaskStatus = async (task: Task, newStatus: string) => {
    if (task.status === "completed") return;
    const update: any = { status: newStatus };
    if (newStatus === "completed") update.completed_at = new Date().toISOString();
    await supabase.from("strategic_tasks").update(update).eq("id", task.id);
    await logChange("task", task.id, "status_change", `تغيير الحالة إلى: ${STATUS_MAP[newStatus]?.label}`);
    fetchAll();
    // Recalculate objective progress
    const objTasks = tasks.filter(t => t.objective_id === task.objective_id);
    const completedCount = objTasks.filter(t => t.id === task.id ? newStatus === "completed" : t.status === "completed").length;
    const objProgress = objTasks.length > 0 ? Math.round((completedCount / objTasks.length) * 100) : 0;
    await supabase.from("strategic_objectives").update({
      progress_percentage: objProgress,
      status: objProgress >= 100 ? "completed" : objProgress > 0 ? "in_progress" : "not_started"
    }).eq("id", task.objective_id);
    // Recalculate goal progress
    const obj = objectives.find(o => o.id === task.objective_id);
    if (obj) {
      const goalObjs = objectives.filter(o => o.goal_id === obj.goal_id);
      const goalProgress = goalObjs.length > 0
        ? Math.round(goalObjs.reduce((sum, o) => sum + (o.id === obj.id ? objProgress : o.progress_percentage), 0) / goalObjs.length)
        : 0;
      await handleUpdateGoalProgress(obj.goal_id, goalProgress);
    }
  };

  const handleDeleteTask = async (task: Task) => {
    if (task.status === "completed") { toast({ title: "لا يمكن حذف مهمة مكتملة", variant: "destructive" }); return; }
    const { error } = await supabase.from("strategic_tasks").delete().eq("id", task.id);
    if (!error) { await logChange("task", task.id, "delete", `حذف: ${task.title}`); fetchAll(); toast({ title: "تم حذف المهمة" }); }
  };

  // === Stats ===
  const totalGoals = goals.length;
  const completedGoals = goals.filter(g => g.status === "completed").length;
  const delayedTasks = tasks.filter(t => t.status !== "completed" && new Date(t.end_date) < new Date()).length;
  const tasksDueThisMonth = tasks.filter(t => {
    const end = new Date(t.end_date);
    const now = new Date();
    return end.getMonth() === now.getMonth() && end.getFullYear() === now.getFullYear() && t.status !== "completed";
  }).length;
  const overallProgress = totalGoals > 0 ? Math.round(goals.reduce((s, g) => s + g.progress_percentage, 0) / totalGoals) : 0;

  if (loading) return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">الخطة الاستراتيجية</h1>
          <p className="text-muted-foreground">2026 - 2030 | مجمع حويلان لتحفيظ القرآن</p>
        </div>
      </div>

      {/* Dashboard Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Target className="w-8 h-8 mx-auto mb-2 text-primary" />
            <p className="text-2xl font-bold text-foreground">{totalGoals}</p>
            <p className="text-xs text-muted-foreground">الأهداف الاستراتيجية</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <TrendingUp className="w-8 h-8 mx-auto mb-2 text-green-600" />
            <p className="text-2xl font-bold text-foreground">{overallProgress}%</p>
            <p className="text-xs text-muted-foreground">التقدم العام</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <ListChecks className="w-8 h-8 mx-auto mb-2 text-blue-600" />
            <p className="text-2xl font-bold text-foreground">{tasksDueThisMonth}</p>
            <p className="text-xs text-muted-foreground">مهام هذا الشهر</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-destructive" />
            <p className="text-2xl font-bold text-foreground">{delayedTasks}</p>
            <p className="text-xs text-muted-foreground">مهام متأخرة</p>
          </CardContent>
        </Card>
      </div>

      {/* Overall Progress */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground">التقدم الإجمالي للخطة</span>
            <span className="text-sm text-muted-foreground">{overallProgress}%</span>
          </div>
          <Progress value={overallProgress} className="h-3" />
          <div className="flex justify-between mt-2 text-xs text-muted-foreground">
            <span>2026</span><span>2027</span><span>2028</span><span>2029</span><span>2030</span>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="goals" className="space-y-4">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="goals">الأهداف والمحاور</TabsTrigger>
          <TabsTrigger value="tasks">جميع المهام</TabsTrigger>
          <TabsTrigger value="delayed">المتأخرات</TabsTrigger>
        </TabsList>

        {/* Goals Tab */}
        <TabsContent value="goals" className="space-y-4">
          {canManageGoals && (
            <Dialog open={goalDialog} onOpenChange={(v) => { setGoalDialog(v); if (!v) setEditingGoal(null); }}>
              <DialogTrigger asChild>
                <Button><Plus className="w-4 h-4 ml-2" />إضافة هدف استراتيجي</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg" dir="rtl">
                <DialogHeader><DialogTitle>{editingGoal ? "تعديل الهدف" : "هدف استراتيجي جديد"}</DialogTitle></DialogHeader>
                <form onSubmit={handleSaveGoal} className="space-y-4">
                  <div><Label>العنوان</Label><Input name="title" required defaultValue={editingGoal?.title} /></div>
                  <div><Label>الوصف</Label><Textarea name="description" defaultValue={editingGoal?.description || ""} /></div>
                  <div><Label>المحور</Label>
                    <Select name="axis" defaultValue={editingGoal?.axis || "memorization_quality"}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{AXES.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div><Label>تاريخ البداية</Label><Input name="start_date" type="date" required defaultValue={editingGoal?.start_date || new Date().toISOString().split("T")[0]} /></div>
                    <div><Label>تاريخ النهاية</Label><Input name="end_date" type="date" required defaultValue={editingGoal?.end_date || "2030-12-31"} /></div>
                  </div>
                  <Button type="submit" className="w-full">{editingGoal ? "حفظ التعديلات" : "إنشاء الهدف"}</Button>
                </form>
              </DialogContent>
            </Dialog>
          )}

          {/* Goals by Axis */}
          {AXES.map(axis => {
            const axisGoals = goals.filter(g => g.axis === axis.value);
            if (axisGoals.length === 0) return null;
            return (
              <div key={axis.value} className="space-y-3">
                <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
                  <Flag className="w-5 h-5 text-primary" />{axis.label}
                </h3>
                {axisGoals.map(goal => (
                  <Card key={goal.id} className="border-r-4 border-r-primary">
                    <CardHeader className="p-4 pb-2 cursor-pointer" onClick={() => setExpandedGoal(expandedGoal === goal.id ? null : goal.id)}>
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <CardTitle className="text-base">{goal.title}</CardTitle>
                            <Badge className={STATUS_MAP[goal.status]?.color}>{STATUS_MAP[goal.status]?.label}</Badge>
                            {goal.is_activated && <Badge variant="outline" className="text-xs">مفعّل</Badge>}
                          </div>
                          {goal.description && <CardDescription className="mt-1">{goal.description}</CardDescription>}
                        </div>
                        {expandedGoal === goal.id ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <Progress value={goal.progress_percentage} className="h-2 flex-1" />
                        <span className="text-xs text-muted-foreground">{goal.progress_percentage}%</span>
                      </div>
                    </CardHeader>

                    {expandedGoal === goal.id && (
                      <CardContent className="p-4 pt-0 space-y-4">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="w-3 h-3" />{formatDateHijriOnly(goal.start_date)} — {goal.end_date ? formatDateHijriOnly(goal.end_date) : "—"}
                        </div>

                        {canManageGoals && (
                          <div className="flex gap-2 flex-wrap">
                            {!goal.is_activated && (
                              <Button size="sm" variant="outline" onClick={() => handleActivateGoal(goal)}>
                                <CheckCircle className="w-3 h-3 ml-1" />تفعيل
                              </Button>
                            )}
                            <Button size="sm" variant="outline" onClick={() => { setEditingGoal(goal); setGoalDialog(true); }}>
                              <Edit className="w-3 h-3 ml-1" />تعديل
                            </Button>
                            {!goal.is_activated && (
                              <Button size="sm" variant="destructive" onClick={() => handleDeleteGoal(goal)}>
                                <Trash2 className="w-3 h-3 ml-1" />حذف
                              </Button>
                            )}
                          </div>
                        )}

                        {/* Objectives under this goal */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium text-sm text-foreground">الأهداف الفرعية</h4>
                            {canManageTasks && (
                              <Button size="sm" variant="ghost" onClick={() => { setSelectedGoalId(goal.id); setEditingObjective(null); setObjectiveDialog(true); }}>
                                <Plus className="w-3 h-3 ml-1" />إضافة
                              </Button>
                            )}
                          </div>
                          {objectives.filter(o => o.goal_id === goal.id).map(obj => (
                            <div key={obj.id} className="border rounded-lg p-3 space-y-2 bg-muted/30">
                              <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedObjective(expandedObjective === obj.id ? null : obj.id)}>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-medium text-sm text-foreground">{obj.title}</span>
                                  <Badge className={`text-xs ${STATUS_MAP[obj.status]?.color}`}>{STATUS_MAP[obj.status]?.label}</Badge>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">{obj.progress_percentage}%</span>
                                  {expandedObjective === obj.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                </div>
                              </div>
                              <Progress value={obj.progress_percentage} className="h-1.5" />

                              {expandedObjective === obj.id && (
                                <div className="space-y-3 pt-2">
                                  {obj.description && <p className="text-xs text-muted-foreground">{obj.description}</p>}
                                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Calendar className="w-3 h-3" />{formatDateHijriOnly(obj.start_date)} — {obj.end_date ? formatDateHijriOnly(obj.end_date) : "—"}
                                  </div>
                                  {canManageTasks && (
                                    <div className="flex gap-2">
                                      <Button size="sm" variant="outline" onClick={() => { setSelectedGoalId(goal.id); setEditingObjective(obj); setObjectiveDialog(true); }}>
                                        <Edit className="w-3 h-3 ml-1" />تعديل
                                      </Button>
                                      <Button size="sm" variant="destructive" onClick={() => handleDeleteObjective(obj)}>
                                        <Trash2 className="w-3 h-3 ml-1" />حذف
                                      </Button>
                                    </div>
                                  )}

                                  {/* Tasks */}
                                  <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                      <h5 className="text-xs font-medium text-foreground">المهام</h5>
                                      {canManageTasks && (
                                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setSelectedObjectiveId(obj.id); setEditingTask(null); setTaskDialog(true); }}>
                                          <Plus className="w-3 h-3 ml-1" />إضافة مهمة
                                        </Button>
                                      )}
                                    </div>
                                    {tasks.filter(t => t.objective_id === obj.id).map(task => (
                                      <TaskCard
                                        key={task.id}
                                        task={task}
                                        profiles={profiles}
                                        canManage={canManageTasks || (role === "admin_staff" && task.assigned_to === user?.id)}
                                        canEdit={canManageTasks}
                                        onStatusChange={(s) => handleUpdateTaskStatus(task, s)}
                                        onEdit={() => { setSelectedObjectiveId(task.objective_id); setEditingTask(task); setTaskDialog(true); }}
                                        onDelete={() => handleDeleteTask(task)}
                                      />
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            );
          })}
          {goals.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Target className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>لم يتم إضافة أهداف استراتيجية بعد</p>
            </div>
          )}
        </TabsContent>

        {/* All Tasks Tab */}
        <TabsContent value="tasks" className="space-y-3">
          {tasks.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">لا توجد مهام</p>
          ) : (
            tasks.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                profiles={profiles}
                canManage={canManageTasks || (role === "admin_staff" && task.assigned_to === user?.id)}
                canEdit={canManageTasks}
                onStatusChange={(s) => handleUpdateTaskStatus(task, s)}
                onEdit={() => { setSelectedObjectiveId(task.objective_id); setEditingTask(task); setTaskDialog(true); }}
                onDelete={() => handleDeleteTask(task)}
                showObjective
                objectives={objectives}
              />
            ))
          )}
        </TabsContent>

        {/* Delayed Tab */}
        <TabsContent value="delayed" className="space-y-3">
          {tasks.filter(t => t.status !== "completed" && new Date(t.end_date) < new Date()).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>لا توجد مهام متأخرة 🎉</p>
            </div>
          ) : (
            tasks.filter(t => t.status !== "completed" && new Date(t.end_date) < new Date()).map(task => (
              <TaskCard
                key={task.id}
                task={task}
                profiles={profiles}
                canManage={canManageTasks || (role === "admin_staff" && task.assigned_to === user?.id)}
                canEdit={canManageTasks}
                onStatusChange={(s) => handleUpdateTaskStatus(task, s)}
                onEdit={() => { setSelectedObjectiveId(task.objective_id); setEditingTask(task); setTaskDialog(true); }}
                onDelete={() => handleDeleteTask(task)}
                showObjective
                objectives={objectives}
              />
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Objective Dialog */}
      <Dialog open={objectiveDialog} onOpenChange={(v) => { setObjectiveDialog(v); if (!v) setEditingObjective(null); }}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader><DialogTitle>{editingObjective ? "تعديل الهدف الفرعي" : "هدف فرعي جديد"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSaveObjective} className="space-y-4">
            <div><Label>العنوان</Label><Input name="title" required defaultValue={editingObjective?.title} /></div>
            <div><Label>الوصف</Label><Textarea name="description" defaultValue={editingObjective?.description || ""} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>تاريخ البداية</Label><Input name="start_date" type="date" required defaultValue={editingObjective?.start_date || new Date().toISOString().split("T")[0]} /></div>
              <div><Label>تاريخ النهاية</Label><Input name="end_date" type="date" required defaultValue={editingObjective?.end_date || ""} /></div>
            </div>
            <Button type="submit" className="w-full">{editingObjective ? "حفظ التعديلات" : "إنشاء الهدف الفرعي"}</Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Task Dialog */}
      <Dialog open={taskDialog} onOpenChange={(v) => { setTaskDialog(v); if (!v) setEditingTask(null); }}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader><DialogTitle>{editingTask ? "تعديل المهمة" : "مهمة جديدة"}</DialogTitle></DialogHeader>
          <form onSubmit={handleSaveTask} className="space-y-4">
            <div><Label>العنوان</Label><Input name="title" required defaultValue={editingTask?.title} /></div>
            <div><Label>الوصف</Label><Textarea name="description" defaultValue={editingTask?.description || ""} /></div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>الدور المسؤول</Label>
                <Select name="responsible_role" defaultValue={editingTask?.responsible_role || "manager"}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manager">مدير</SelectItem>
                    <SelectItem value="supervisor">مشرف</SelectItem>
                    <SelectItem value="teacher">معلم</SelectItem>
                    <SelectItem value="admin_staff">موظف إداري</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>الأولوية</Label>
                <Select name="priority" defaultValue={editingTask?.priority || "medium"}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">منخفض</SelectItem>
                    <SelectItem value="medium">متوسط</SelectItem>
                    <SelectItem value="high">عالي</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div><Label>تعيين إلى</Label>
              <Select name="assigned_to" defaultValue={editingTask?.assigned_to || ""}>
                <SelectTrigger><SelectValue placeholder="اختياري" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="">بدون تعيين</SelectItem>
                  {profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>تاريخ البداية</Label><Input name="start_date" type="date" required defaultValue={editingTask?.start_date || new Date().toISOString().split("T")[0]} /></div>
              <div><Label>تاريخ النهاية</Label><Input name="end_date" type="date" required defaultValue={editingTask?.end_date || ""} /></div>
            </div>
            <div><Label>ملاحظات</Label><Textarea name="notes" defaultValue={editingTask?.notes || ""} /></div>
            <Button type="submit" className="w-full">{editingTask ? "حفظ التعديلات" : "إنشاء المهمة"}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// === Task Card Component ===
const TaskCard = ({ task, profiles, canManage, canEdit, onStatusChange, onEdit, onDelete, showObjective, objectives }: {
  task: Task; profiles: any[]; canManage: boolean; canEdit: boolean;
  onStatusChange: (s: string) => void; onEdit: () => void; onDelete: () => void;
  showObjective?: boolean; objectives?: Objective[];
}) => {
  const isDelayed = task.status !== "completed" && new Date(task.end_date) < new Date();
  const assignedProfile = profiles.find(p => p.id === task.assigned_to);
  const objective = objectives?.find(o => o.id === task.objective_id);

  return (
    <div className={`border rounded-lg p-3 space-y-2 ${isDelayed ? "border-destructive/50 bg-destructive/5" : "bg-card"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm text-foreground">{task.title}</span>
            <Badge className={`text-xs ${STATUS_MAP[task.status]?.color}`}>{STATUS_MAP[task.status]?.label}</Badge>
            <Badge className={`text-xs ${PRIORITY_MAP[task.priority]?.color}`}>{PRIORITY_MAP[task.priority]?.label}</Badge>
            {isDelayed && <Badge className="text-xs bg-destructive/10 text-destructive"><AlertTriangle className="w-3 h-3 ml-1" />متأخر</Badge>}
          </div>
          {task.description && <p className="text-xs text-muted-foreground mt-1">{task.description}</p>}
          {showObjective && objective && <p className="text-xs text-primary mt-1">← {objective.title}</p>}
        </div>
      </div>
      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDateHijriOnly(task.start_date)} — {task.end_date ? formatDateHijriOnly(task.end_date) : "—"}</span>
        {assignedProfile && <span>{assignedProfile.full_name}</span>}
      </div>
      {task.notes && <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">{task.notes}</p>}
      {canManage && task.status !== "completed" && (
        <div className="flex gap-2 flex-wrap pt-1">
          {task.status === "not_started" && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onStatusChange("in_progress")}><Clock className="w-3 h-3 ml-1" />بدء التنفيذ</Button>}
          {task.status === "in_progress" && <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onStatusChange("completed")}><CheckCircle className="w-3 h-3 ml-1" />إكمال</Button>}
          {task.status === "in_progress" && <Button size="sm" variant="outline" className="h-7 text-xs text-destructive" onClick={() => onStatusChange("delayed")}>متأخر</Button>}
          {canEdit && <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onEdit}><Edit className="w-3 h-3" /></Button>}
          {canEdit && <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={onDelete}><Trash2 className="w-3 h-3" /></Button>}
        </div>
      )}
    </div>
  );
};

export default StrategicPlan;
