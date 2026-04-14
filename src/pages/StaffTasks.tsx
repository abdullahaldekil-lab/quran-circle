import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Plus, Clock, CheckCircle2, XCircle, AlertTriangle, Play, MessageSquare, Send, RotateCcw, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { formatDateSmart, formatDateTimeSmart } from "@/lib/hijri";
import { sendNotification } from "@/utils/sendNotification";
import PageDateHeader from "@/components/PageDateHeader";

const CATEGORIES = ["عام", "تعليمي", "إداري", "صيانة", "متابعة", "تقارير"];
const PRIORITIES = ["عاجل", "عالي", "عادي", "منخفض"];
const STATUSES = ["pending", "in_progress", "completed", "cancelled", "overdue"];
const STATUS_LABELS: Record<string, string> = {
  pending: "معلّقة", in_progress: "قيد التنفيذ", completed: "مكتملة", cancelled: "ملغاة", overdue: "متأخرة",
};
const PRIORITY_COLORS: Record<string, string> = {
  عاجل: "bg-destructive text-destructive-foreground",
  عالي: "bg-orange-500 text-white",
  عادي: "bg-primary text-primary-foreground",
  منخفض: "bg-muted text-muted-foreground",
};
const REMINDER_OPTIONS = [
  { label: "30 دقيقة قبل", minutes: 30 },
  { label: "ساعة قبل", minutes: 60 },
  { label: "يوم قبل", minutes: 1440 },
  { label: "يومين قبل", minutes: 2880 },
];

type Task = {
  id: string; title: string; description: string | null; category: string; priority: string;
  status: string; assigned_by: string | null; assigned_to: string | null; assigned_to_role: string | null;
  due_date: string | null; due_time: string | null; reminder_at: string | null; reminder_sent: boolean | null;
  started_at: string | null; completed_at: string | null; estimated_minutes: number | null;
  actual_minutes: number | null; completion_note: string | null; attachments: any;
  created_at: string; updated_at: string;
};

type Comment = { id: string; task_id: string; from_user_id: string; body: string; created_at: string };

const StaffTasks = () => {
  const { session, profile } = useAuth();
  const { isManager, isSupervisor, role } = useRole();
  const queryClient = useQueryClient();
  const userId = session?.user?.id;

  const [activeTab, setActiveTab] = useState("my-tasks");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [viewMode, setViewMode] = useState<"kanban" | "calendar">("kanban");
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);
  // Filters for assigned tab
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterStaff, setFilterStaff] = useState("all");

  // New task form
  const [form, setForm] = useState({
    title: "", description: "", category: "عام", priority: "عادي",
    assigned_to: "", assigned_to_role: "", due_date: "", estimated_minutes: "",
    reminder_minutes: "", recurrence: "none",
  });
  const [completionNote, setCompletionNote] = useState("");
  const [actualMinutes, setActualMinutes] = useState("");

  // Fetch profiles for assignment
  const { data: profiles = [] } = useQuery({
    queryKey: ["staff-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, role").order("full_name");
      return data || [];
    },
  });

  // Fetch my tasks
  const { data: myTasks = [], isLoading: loadingMy } = useQuery({
    queryKey: ["my-tasks", userId],
    queryFn: async () => {
      if (!userId) return [];
      const { data } = await supabase
        .from("staff_tasks")
        .select("*")
        .or(`assigned_to.eq.${userId},assigned_to_role.eq.${role}`)
        .order("created_at", { ascending: false });
      return (data || []) as Task[];
    },
    enabled: !!userId,
  });

  // Fetch assigned tasks (tasks I created)
  const { data: assignedTasks = [], isLoading: loadingAssigned } = useQuery({
    queryKey: ["assigned-tasks", userId],
    queryFn: async () => {
      if (!userId) return [];
      const query = isManager
        ? supabase.from("staff_tasks").select("*").order("created_at", { ascending: false })
        : supabase.from("staff_tasks").select("*").eq("assigned_by", userId).order("created_at", { ascending: false });
      const { data } = await query;
      return (data || []) as Task[];
    },
    enabled: !!userId && (isManager || isSupervisor),
  });

  // Fetch comments for selected task
  const { data: comments = [] } = useQuery({
    queryKey: ["task-comments", selectedTask?.id],
    queryFn: async () => {
      if (!selectedTask) return [];
      const { data } = await supabase
        .from("staff_task_comments")
        .select("*")
        .eq("task_id", selectedTask.id)
        .order("created_at", { ascending: true });
      return (data || []) as Comment[];
    },
    enabled: !!selectedTask,
  });

  // Audio alert helper
  const playTaskAlert = useCallback(() => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.frequency.value = 880;
      osc.type = "sine";
      gain.gain.value = 0.15;
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
      osc.stop(audioCtx.currentTime + 0.4);
    } catch {}
  }, []);

  // Realtime subscription
  const prevTaskCountRef = useRef(myTasks.length);
  useEffect(() => {
    const channel = supabase
      .channel("staff-tasks-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "staff_tasks" }, () => {
        queryClient.invalidateQueries({ queryKey: ["my-tasks"] });
        queryClient.invalidateQueries({ queryKey: ["assigned-tasks"] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // Play sound when new tasks appear
  useEffect(() => {
    if (myTasks.length > prevTaskCountRef.current) {
      playTaskAlert();
      toast.info("📋 تم إسناد مهمة جديدة إليك");
    }
    prevTaskCountRef.current = myTasks.length;
  }, [myTasks.length, playTaskAlert]);

  // Check if task is urgent and due within 1 hour
  const isUrgentSoon = (task: Task) => {
    if (!task.due_date || task.status === "completed" || task.status === "cancelled") return false;
    const due = new Date(task.due_date + (task.due_time ? `T${task.due_time}` : "T23:59:59"));
    const diff = due.getTime() - Date.now();
    return diff > 0 && diff < 3600000; // less than 1 hour
  };


  const processedMyTasks = useMemo(() => {
    const now = new Date();
    return myTasks.map(t => {
      if (t.due_date && t.status !== "completed" && t.status !== "cancelled") {
        const due = new Date(t.due_date + (t.due_time ? `T${t.due_time}` : "T23:59:59"));
        if (due < now && t.status !== "overdue") return { ...t, status: "overdue" };
      }
      return t;
    });
  }, [myTasks]);

  // Group tasks by status for Kanban
  const kanbanColumns = useMemo(() => {
    const cols: Record<string, Task[]> = { pending: [], in_progress: [], completed: [], overdue: [] };
    processedMyTasks.forEach(t => {
      const s = t.status === "cancelled" ? "pending" : t.status;
      if (cols[s]) cols[s].push(t);
      else cols.pending.push(t);
    });
    return cols;
  }, [processedMyTasks]);

  // Filtered assigned tasks
  const filteredAssigned = useMemo(() => {
    return assignedTasks.filter(t => {
      if (filterStatus !== "all" && t.status !== filterStatus) return false;
      if (filterCategory !== "all" && t.category !== filterCategory) return false;
      if (filterPriority !== "all" && t.priority !== filterPriority) return false;
      if (filterStaff !== "all" && t.assigned_to !== filterStaff) return false;
      return true;
    });
  }, [assignedTasks, filterStatus, filterCategory, filterPriority, filterStaff]);

  const getProfileName = (id: string | null) => profiles.find(p => p.id === id)?.full_name || "—";

  // Mutations
  const updateTask = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Task> }) => {
      const { error } = await supabase.from("staff_tasks").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["assigned-tasks"] });
    },
  });

  const createTask = useMutation({
    mutationFn: async () => {
      const dueDateTime = form.due_date ? new Date(form.due_date) : null;
      let reminderAt: string | null = null;
      if (dueDateTime && form.reminder_minutes) {
        const r = new Date(dueDateTime.getTime() - Number(form.reminder_minutes) * 60000);
        reminderAt = r.toISOString();
      }

      const payload: any = {
        title: form.title,
        description: form.description || null,
        category: form.category,
        priority: form.priority,
        assigned_by: userId,
        due_date: dueDateTime ? format(dueDateTime, "yyyy-MM-dd") : null,
        due_time: dueDateTime ? format(dueDateTime, "HH:mm:ss") : null,
        estimated_minutes: form.estimated_minutes ? Number(form.estimated_minutes) : null,
        reminder_at: reminderAt,
        recurrence: form.recurrence || "none",
      };

      if (form.assigned_to) {
        payload.assigned_to = form.assigned_to;
        payload.assigned_to_role = null;
      } else if (form.assigned_to_role) {
        payload.assigned_to_role = form.assigned_to_role;
        payload.assigned_to = null;
      }

      const { error } = await supabase.from("staff_tasks").insert(payload);
      if (error) throw error;

      // Create recurring copies if needed
      if (form.recurrence !== "none" && dueDateTime) {
        const copies = [];
        for (let i = 1; i <= 4; i++) {
          const nextDate = new Date(dueDateTime);
          if (form.recurrence === "daily") nextDate.setDate(nextDate.getDate() + i);
          else if (form.recurrence === "weekly") nextDate.setDate(nextDate.getDate() + i * 7);
          copies.push({
            ...payload,
            due_date: format(nextDate, "yyyy-MM-dd"),
            due_time: dueDateTime ? format(dueDateTime, "HH:mm:ss") : null,
            reminder_at: form.reminder_minutes ? new Date(nextDate.getTime() - Number(form.reminder_minutes) * 60000).toISOString() : null,
          });
        }
        await supabase.from("staff_tasks").insert(copies);
      }

      // Send notification
      if (form.assigned_to) {
        sendNotification({
          templateCode: "NEW_TASK",
          recipientIds: [form.assigned_to],
          variables: { title: form.title, priority: form.priority },
          metaData: { templateCode: "NEW_TASK" },
        });
      }
    },
    onSuccess: () => {
      toast.success("تم إنشاء المهمة بنجاح");
      setCreateOpen(false);
      setForm({ title: "", description: "", category: "عام", priority: "عادي", assigned_to: "", assigned_to_role: "", due_date: "", estimated_minutes: "", reminder_minutes: "", recurrence: "none" });
      queryClient.invalidateQueries({ queryKey: ["assigned-tasks"] });
    },
    onError: () => toast.error("حدث خطأ أثناء إنشاء المهمة"),
  });

  const addComment = useMutation({
    mutationFn: async () => {
      if (!selectedTask || !newComment.trim()) return;
      const { error } = await supabase.from("staff_task_comments").insert({
        task_id: selectedTask.id,
        from_user_id: userId,
        body: newComment.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewComment("");
      queryClient.invalidateQueries({ queryKey: ["task-comments"] });
    },
  });

  const handleStart = () => {
    if (!selectedTask) return;
    updateTask.mutate({ id: selectedTask.id, updates: { status: "in_progress", started_at: new Date().toISOString() } });
    setSelectedTask(prev => prev ? { ...prev, status: "in_progress", started_at: new Date().toISOString() } : null);
    toast.success("تم بدء المهمة");
  };

  const handleComplete = () => {
    if (!selectedTask) return;
    updateTask.mutate({
      id: selectedTask.id,
      updates: {
        status: "completed",
        completed_at: new Date().toISOString(),
        completion_note: completionNote || null,
        actual_minutes: actualMinutes ? Number(actualMinutes) : null,
      },
    });

    // Notify task assigner about completion
    if (selectedTask.assigned_by && selectedTask.assigned_by !== userId) {
      const currentUserName = profile?.full_name || "موظف";
      sendNotification({
        templateCode: "TASK_COMPLETED",
        recipientIds: [selectedTask.assigned_by],
        variables: { staffName: currentUserName, title: selectedTask.title },
        metaData: { task_id: selectedTask.id, templateCode: "TASK_COMPLETED" },
      });
    }

    setCompleteOpen(false);
    setDetailOpen(false);
    setCompletionNote("");
    setActualMinutes("");
    toast.success("تم إكمال المهمة بنجاح");
  };

  const handleCancel = () => {
    if (!selectedTask) return;
    updateTask.mutate({ id: selectedTask.id, updates: { status: "cancelled" } });
    setDetailOpen(false);
    toast.info("تم إلغاء المهمة");
  };

  const openDetail = (task: Task) => { setSelectedTask(task); setDetailOpen(true); };

  const KanbanCard = ({ task }: { task: Task }) => {
    const isOverdue = task.status === "overdue";
    const urgent = isUrgentSoon(task);
    return (
      <Card
        className={`cursor-pointer hover:shadow-md transition-shadow mb-3 relative ${isOverdue ? "border-2 border-destructive" : ""} ${urgent ? "ring-2 ring-destructive ring-offset-1" : ""}`}
        onClick={() => openDetail(task)}
      >
        {urgent && (
          <span className="absolute -top-1.5 -left-1.5 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-destructive"></span>
          </span>
        )}
        <CardContent className="p-3 space-y-2">
          <p className="font-semibold text-sm leading-tight">{task.title}</p>
          <div className="flex flex-wrap gap-1">
            <Badge variant="outline" className="text-xs">{task.category}</Badge>
            <Badge className={`text-xs ${PRIORITY_COLORS[task.priority] || ""}`}>{task.priority}</Badge>
          </div>
          {task.due_date && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDateSmart(task.due_date)}
              {task.due_time && ` ${task.due_time.slice(0, 5)}`}
            </p>
          )}
          <p className="text-xs text-muted-foreground">من: {getProfileName(task.assigned_by)}</p>
        </CardContent>
      </Card>
    );
  };

  const KanbanColumn = ({ title, icon, tasks, color }: { title: string; icon: React.ReactNode; tasks: Task[]; color: string }) => (
    <div className="flex-1 min-w-[250px]">
      <div className={`flex items-center gap-2 mb-3 p-2 rounded-lg ${color}`}>
        {icon}
        <span className="font-semibold text-sm">{title}</span>
        <Badge variant="secondary" className="mr-auto">{tasks.length}</Badge>
      </div>
      <ScrollArea className="h-[calc(100vh-320px)]">
        {tasks.map(t => <KanbanCard key={t.id} task={t} />)}
        {tasks.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">لا توجد مهام</p>}
      </ScrollArea>
    </div>
  );

  // Calendar helpers
  const calendarDays = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPad = firstDay.getDay(); // 0=Sun
    const days: { date: string; day: number; inMonth: boolean }[] = [];
    // Pad start
    for (let i = startPad - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push({ date: format(d, "yyyy-MM-dd"), day: d.getDate(), inMonth: false });
    }
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push({ date: format(new Date(year, month, d), "yyyy-MM-dd"), day: d, inMonth: true });
    }
    // Pad end to fill 35 slots
    while (days.length < 35) {
      const d = new Date(year, month + 1, days.length - lastDay.getDate() - startPad + 1);
      days.push({ date: format(d, "yyyy-MM-dd"), day: d.getDate(), inMonth: false });
    }
    return days;
  }, [calendarMonth]);

  const tasksByDate = useMemo(() => {
    const map: Record<string, Task[]> = {};
    processedMyTasks.forEach(t => {
      if (t.due_date) {
        if (!map[t.due_date]) map[t.due_date] = [];
        map[t.due_date].push(t);
      }
    });
    return map;
  }, [processedMyTasks]);

  const filteredByCalendarDate = useMemo(() => {
    if (!selectedCalendarDate) return processedMyTasks;
    return processedMyTasks.filter(t => t.due_date === selectedCalendarDate);
  }, [processedMyTasks, selectedCalendarDate]);

  return (
    <div className="space-y-4" dir="rtl">
      <PageDateHeader />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <TabsList>
            <TabsTrigger value="my-tasks">مهامي</TabsTrigger>
            {(isManager || isSupervisor) && <TabsTrigger value="assigned">المهام المُسنَدة</TabsTrigger>}
          </TabsList>
          {activeTab === "my-tasks" && (
            <Button variant="outline" size="sm" onClick={() => { setViewMode(v => v === "kanban" ? "calendar" : "kanban"); setSelectedCalendarDate(null); }}>
              <CalendarDays className="h-4 w-4 ml-1" />
              {viewMode === "kanban" ? "تقويم" : "Kanban"}
            </Button>
          )}
        </div>

        {/* My Tasks */}
        <TabsContent value="my-tasks" className="mt-4">
          {viewMode === "kanban" ? (
            <div className="flex gap-4 overflow-x-auto pb-4">
              <KanbanColumn title="معلّقة" icon={<Clock className="h-4 w-4" />} tasks={kanbanColumns.pending} color="bg-muted/50" />
              <KanbanColumn title="قيد التنفيذ" icon={<Play className="h-4 w-4" />} tasks={kanbanColumns.in_progress} color="bg-blue-50 dark:bg-blue-950/30" />
              <KanbanColumn title="مكتملة" icon={<CheckCircle2 className="h-4 w-4" />} tasks={kanbanColumns.completed} color="bg-green-50 dark:bg-green-950/30" />
              <KanbanColumn title="متأخرة" icon={<AlertTriangle className="h-4 w-4" />} tasks={kanbanColumns.overdue} color="bg-red-50 dark:bg-red-950/30" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Calendar header */}
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="icon" onClick={() => setCalendarMonth(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <span className="font-semibold">{formatDateSmart(calendarMonth)}</span>
                <Button variant="ghost" size="icon" onClick={() => setCalendarMonth(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>
              {/* Day labels */}
              <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
                {["أحد", "إثنين", "ثلاثاء", "أربعاء", "خميس", "جمعة", "سبت"].map(d => <div key={d}>{d}</div>)}
              </div>
              {/* Calendar grid */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((cell, i) => {
                  const dayTasks = tasksByDate[cell.date] || [];
                  const isSelected = selectedCalendarDate === cell.date;
                  const isToday = cell.date === new Date().toISOString().split("T")[0];
                  return (
                    <div
                      key={i}
                      onClick={() => setSelectedCalendarDate(isSelected ? null : cell.date)}
                      className={`min-h-[60px] p-1 border rounded cursor-pointer text-xs transition-colors ${
                        !cell.inMonth ? "opacity-30" : ""
                      } ${isSelected ? "border-primary bg-primary/5" : "border-border"} ${isToday ? "bg-blue-50 dark:bg-blue-950/20" : ""}`}
                    >
                      <div className="font-medium mb-0.5">{cell.day}</div>
                      {dayTasks.slice(0, 3).map(t => (
                        <Badge key={t.id} className={`text-[10px] px-1 py-0 mb-0.5 block truncate ${PRIORITY_COLORS[t.priority]}`}>
                          {t.title}
                        </Badge>
                      ))}
                      {dayTasks.length > 3 && <span className="text-[10px] text-muted-foreground">+{dayTasks.length - 3}</span>}
                    </div>
                  );
                })}
              </div>
              {/* Tasks for selected date */}
              {selectedCalendarDate && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">مهام {selectedCalendarDate}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {filteredByCalendarDate.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">لا توجد مهام في هذا اليوم</p>
                    ) : (
                      filteredByCalendarDate.map(t => <KanbanCard key={t.id} task={t} />)
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        {/* Assigned Tasks Table */}
        {(isManager || isSupervisor) && (
          <TabsContent value="assigned" className="mt-4 space-y-4">
            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-end">
              <div>
                <Label className="text-xs">الحالة</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">الكل</SelectItem>
                    {STATUSES.map(s => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">الفئة</Label>
                <Select value={filterCategory} onValueChange={setFilterCategory}>
                  <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">الكل</SelectItem>
                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">الأولوية</Label>
                <Select value={filterPriority} onValueChange={setFilterPriority}>
                  <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">الكل</SelectItem>
                    {PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">الموظف</Label>
                <Select value={filterStaff} onValueChange={setFilterStaff}>
                  <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">الكل</SelectItem>
                    {profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={() => setCreateOpen(true)} className="gap-1">
                <Plus className="h-4 w-4" /> مهمة جديدة
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>العنوان</TableHead>
                      <TableHead>المُسنَد إليه</TableHead>
                      <TableHead>الفئة</TableHead>
                      <TableHead>الأولوية</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>الاستحقاق</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAssigned.map(t => (
                      <TableRow key={t.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openDetail(t)}>
                        <TableCell className="font-medium">{t.title}</TableCell>
                        <TableCell>{t.assigned_to ? getProfileName(t.assigned_to) : t.assigned_to_role || "—"}</TableCell>
                        <TableCell><Badge variant="outline">{t.category}</Badge></TableCell>
                        <TableCell><Badge className={PRIORITY_COLORS[t.priority]}>{t.priority}</Badge></TableCell>
                        <TableCell><Badge variant="secondary">{STATUS_LABELS[t.status] || t.status}</Badge></TableCell>
                        <TableCell className="text-sm">{t.due_date ? formatDateSmart(t.due_date) : "—"}</TableCell>
                      </TableRow>
                    ))}
                    {filteredAssigned.length === 0 && (
                      <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">لا توجد مهام</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Task Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg" dir="rtl">
          {selectedTask && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedTask.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                {selectedTask.description && <p className="text-muted-foreground">{selectedTask.description}</p>}
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{selectedTask.category}</Badge>
                  <Badge className={PRIORITY_COLORS[selectedTask.priority]}>{selectedTask.priority}</Badge>
                  <Badge variant="secondary">{STATUS_LABELS[selectedTask.status] || selectedTask.status}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-muted-foreground">من:</span> {getProfileName(selectedTask.assigned_by)}</div>
                  <div><span className="text-muted-foreground">إلى:</span> {selectedTask.assigned_to ? getProfileName(selectedTask.assigned_to) : selectedTask.assigned_to_role || "—"}</div>
                  {selectedTask.due_date && <div><span className="text-muted-foreground">الاستحقاق:</span> {formatDateSmart(selectedTask.due_date)} {selectedTask.due_time?.slice(0, 5)}</div>}
                  {selectedTask.estimated_minutes && <div><span className="text-muted-foreground">الوقت المُقدَّر:</span> {selectedTask.estimated_minutes} دقيقة</div>}
                  {selectedTask.actual_minutes && <div><span className="text-muted-foreground">الوقت الفعلي:</span> {selectedTask.actual_minutes} دقيقة</div>}
                </div>
                {selectedTask.completion_note && (
                  <div className="bg-muted p-2 rounded text-xs"><span className="font-semibold">ملاحظة الإنجاز:</span> {selectedTask.completion_note}</div>
                )}

                {/* Action buttons */}
                {selectedTask.assigned_to === userId && selectedTask.status !== "completed" && selectedTask.status !== "cancelled" && (
                  <div className="flex gap-2 pt-2">
                    {(selectedTask.status === "pending" || selectedTask.status === "overdue") && (
                      <Button size="sm" onClick={handleStart} className="gap-1"><Play className="h-3 w-3" /> ابدأ</Button>
                    )}
                    <Button size="sm" variant="default" onClick={() => setCompleteOpen(true)} className="gap-1"><CheckCircle2 className="h-3 w-3" /> أكملت</Button>
                    <Button size="sm" variant="destructive" onClick={handleCancel} className="gap-1"><XCircle className="h-3 w-3" /> إلغاء</Button>
                  </div>
                )}

                <Separator />

                {/* Comments */}
                <div className="space-y-2">
                  <p className="font-semibold text-xs flex items-center gap-1"><MessageSquare className="h-3 w-3" /> التعليقات</p>
                  <ScrollArea className="max-h-[200px]">
                    {comments.map(c => (
                      <div key={c.id} className="bg-muted/50 p-2 rounded mb-2">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>{getProfileName(c.from_user_id)}</span>
                          <span>{formatDateTimeSmart(c.created_at)}</span>
                        </div>
                        <p className="text-sm mt-1">{c.body}</p>
                      </div>
                    ))}
                    {comments.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">لا توجد تعليقات</p>}
                  </ScrollArea>
                  <div className="flex gap-2">
                    <Input placeholder="أضف تعليقاً..." value={newComment} onChange={e => setNewComment(e.target.value)} onKeyDown={e => e.key === "Enter" && addComment.mutate()} />
                    <Button size="icon" variant="ghost" onClick={() => addComment.mutate()} disabled={!newComment.trim()}>
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Complete Dialog */}
      <Dialog open={completeOpen} onOpenChange={setCompleteOpen}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>إكمال المهمة</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>ملاحظة الإنجاز</Label>
              <Textarea value={completionNote} onChange={e => setCompletionNote(e.target.value)} placeholder="اكتب ملاحظة عن الإنجاز..." />
            </div>
            <div>
              <Label>الوقت الفعلي (بالدقائق)</Label>
              <Input type="number" value={actualMinutes} onChange={e => setActualMinutes(e.target.value)} placeholder="مثال: 45" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCompleteOpen(false)}>تراجع</Button>
            <Button onClick={handleComplete}>تأكيد الإكمال</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Task Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader><DialogTitle>مهمة جديدة</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            <div>
              <Label>العنوان *</Label>
              <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <Label>الوصف</Label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>الفئة</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>الأولوية</Label>
                <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>إسناد إلى موظف</Label>
              <Select value={form.assigned_to} onValueChange={v => setForm(f => ({ ...f, assigned_to: v, assigned_to_role: "" }))}>
                <SelectTrigger><SelectValue placeholder="اختر موظف..." /></SelectTrigger>
                <SelectContent>{profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {!form.assigned_to && (
              <div>
                <Label>أو إسناد إلى دور</Label>
                <Select value={form.assigned_to_role} onValueChange={v => setForm(f => ({ ...f, assigned_to_role: v, assigned_to: "" }))}>
                  <SelectTrigger><SelectValue placeholder="اختر دور..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="teacher">معلم</SelectItem>
                    <SelectItem value="assistant_teacher">معلم مساعد</SelectItem>
                    <SelectItem value="supervisor">مشرف</SelectItem>
                    <SelectItem value="secretary">سكرتير</SelectItem>
                    <SelectItem value="admin_staff">إداري</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <Label>تاريخ ووقت الاستحقاق</Label>
              <Input type="datetime-local" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>الوقت المُقدَّر (دقائق)</Label>
                <Input type="number" value={form.estimated_minutes} onChange={e => setForm(f => ({ ...f, estimated_minutes: e.target.value }))} />
              </div>
              <div>
                <Label>تذكير قبل</Label>
                <Select value={form.reminder_minutes} onValueChange={v => setForm(f => ({ ...f, reminder_minutes: v }))}>
                  <SelectTrigger><SelectValue placeholder="اختر..." /></SelectTrigger>
                  <SelectContent>
                    {REMINDER_OPTIONS.map(r => <SelectItem key={r.minutes} value={String(r.minutes)}>{r.label}</SelectItem>)}
                  </SelectContent>
                </Select>
            </div>
            <div>
              <Label>التكرار</Label>
              <Select value={form.recurrence} onValueChange={v => setForm(f => ({ ...f, recurrence: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">بدون تكرار</SelectItem>
                  <SelectItem value="daily">يومي</SelectItem>
                  <SelectItem value="weekly">أسبوعي</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>إلغاء</Button>
            <Button onClick={() => createTask.mutate()} disabled={!form.title || (!form.assigned_to && !form.assigned_to_role)}>
              حفظ وإرسال
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StaffTasks;
