import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDynamicRoles } from "@/hooks/useDynamicRoles";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, AlarmClock, CalendarDays, RefreshCw, Plus } from "lucide-react";
import { toast } from "sonner";
import { formatDateSmart, formatGregorianArabic, WEEKDAYS } from "@/lib/hijri";
import {
  buildHijriMonth, currentHijriPosition, HIJRI_MONTH_NAMES,
  isTaskLate, isWeekendDay, isWithinRange,
} from "@/lib/hijri-calendar";

const STATUS_LABELS: Record<string, string> = {
  pending: "معلّقة", in_progress: "قيد التنفيذ", completed: "مكتملة",
  cancelled: "ملغاة", overdue: "متأخرة",
};
const NEW_TASK_STATUSES = ["pending", "in_progress", "completed"];
const CATEGORIES = ["عام", "تعليمي", "إداري", "صيانة", "متابعة", "تقارير"];
const PRIORITIES = ["عاجل", "عالي", "عادي", "منخفض"];

const YEARS = [1447, 1448, 1449, 1450];

interface Task {
  id: string; title: string; category: string; priority: string; status: string;
  due_date: string | null; due_time: string | null; assigned_to: string | null; assigned_to_role: string | null;
}
interface EventRow { id: string; title: string; event_type: string; event_date: string; event_time: string | null; location: string | null; }
interface Holiday { id: string; title: string; start_date: string; end_date: string; holiday_type: string; }

const emptyForm = {
  title: "", description: "", category: "عام", priority: "عادي", status: "pending",
  due_date: "", due_time: "", assigned_to: "", assigned_to_role: "",
  reminder_value: "1", reminder_unit: "days" as "days" | "hours",
};

/** Reminder timestamp = due datetime minus the chosen lead time (null when disabled). */
export const computeReminderAt = (
  dueDate: string, dueTime: string, value: string, unit: "days" | "hours",
): string | null => {
  const n = Number(value);
  if (!dueDate || !Number.isFinite(n) || n <= 0) return null;
  const base = new Date(`${dueDate}T${dueTime || "08:00"}:00`);
  if (Number.isNaN(base.getTime())) return null;
  const ms = unit === "days" ? n * 86400000 : n * 3600000;
  return new Date(base.getTime() - ms).toISOString();
};


export default function TasksCalendar() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { roles } = useDynamicRoles();
  const initial = currentHijriPosition();
  const [year, setYear] = useState(YEARS.includes(initial.year) ? initial.year : 1448);
  const [month, setMonth] = useState(initial.month);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(false);
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  
  const [staff, setStaff] = useState<{ id: string; full_name: string | null }[]>([]);
  useEffect(() => {
    supabase.from("profiles").select("id, full_name").order("full_name")
      .then(({ data }) => setStaff(data || []));
  }, []);


  const grid = useMemo(() => buildHijriMonth(year, month), [year, month]);
  const todayIso = new Date().toISOString().slice(0, 10);

  const load = useCallback(async () => {
    if (!grid.startIso) return;
    setLoading(true);
    const [t, e, h] = await Promise.all([
      supabase.from("staff_tasks")
        .select("id, title, category, priority, status, due_date, due_time, assigned_to, assigned_to_role")
        .gte("due_date", grid.startIso).lte("due_date", grid.endIso).order("due_date"),
      (supabase as any).from("tarbawi_events")
        .select("id, title, event_type, event_date, event_time, location")
        .gte("event_date", grid.startIso).lte("event_date", grid.endIso).order("event_date"),
      supabase.from("holidays").select("id, title, start_date, end_date, holiday_type")
        .lte("start_date", grid.endIso).gte("end_date", grid.startIso),
    ]);
    setTasks((t.data as Task[]) || []);
    setEvents((e.data as EventRow[]) || []);
    setHolidays((h.data as Holiday[]) || []);
    setLoading(false);
  }, [grid.startIso, grid.endIso]);

  useEffect(() => { load(); }, [load]);

  /** Persist the overdue status (and fire the notification) once per visit. */
  const syncOverdue = useCallback(async (silent = true) => {
    setSyncing(true);
    const { data, error } = await (supabase as any).rpc("mark_overdue_staff_tasks");
    setSyncing(false);
    if (error) { if (!silent) toast.error("تعذّر تحديث المهام المتأخرة"); return; }
    const n = Number(data) || 0;
    if (!silent) toast.success(n > 0 ? `تم تحديث ${n} مهمة إلى «متأخرة»` : "لا توجد مهام متأخرة جديدة");
    if (n > 0) load();
  }, [load]);

  useEffect(() => { syncOverdue(true); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const tasksByDay = useMemo(() => {
    const map: Record<string, Task[]> = {};
    tasks.forEach((t) => { if (t.due_date) (map[t.due_date] ||= []).push(t); });
    return map;
  }, [tasks]);

  const eventsByDay = useMemo(() => {
    const map: Record<string, EventRow[]> = {};
    events.forEach((e) => { (map[e.event_date] ||= []).push(e); });
    return map;
  }, [events]);

  const holidaysFor = useCallback(
    (iso: string) => holidays.filter((h) => isWithinRange(iso, h.start_date, h.end_date)),
    [holidays],
  );

  const lateCount = tasks.filter((t) => isTaskLate(t, todayIso)).length;
  const doneCount = tasks.filter((t) => t.status === "completed").length;

  const step = (delta: number) => {
    let m = month + delta, y = year;
    if (m > 12) { m = 1; y += 1; }
    if (m < 1) { m = 12; y -= 1; }
    if (!YEARS.includes(y)) return;
    setYear(y); setMonth(m);
  };

  const dayTasks = openDay ? tasksByDay[openDay] || [] : [];
  const dayEvents = openDay ? eventsByDay[openDay] || [] : [];
  const dayHolidays = openDay ? holidaysFor(openDay) : [];

  const openAdd = (iso: string) => {
    setForm({ ...emptyForm, due_date: iso });
    setAddOpen(true);
  };

  const notifyTaskCreated = async (task: { id: string; title: string; due_date: string | null; due_time: string | null; priority: string; assigned_to: string | null; assigned_to_role: string | null }) => {
    try {
      let recipients: string[] = [];
      if (task.assigned_to) {
        recipients = [task.assigned_to];
      } else if (task.assigned_to_role) {
        const { data } = await supabase.from("profiles").select("id").eq("role", task.assigned_to_role);
        recipients = (data || []).map((p: any) => p.id);
      }
      const creator = session?.user?.id;
      if (creator && !recipients.includes(creator)) recipients.push(creator);
      recipients = Array.from(new Set(recipients.filter(Boolean)));
      if (!recipients.length) return;

      const due = task.due_date
        ? `${formatDateSmart(task.due_date)}${task.due_time ? ` - ${task.due_time.slice(0, 5)}` : ""}`
        : "بدون تاريخ";
      const rows = recipients.map((uid) => ({
        user_id: uid,
        title: "مهمة جديدة",
        body: `تم إنشاء المهمة "${task.title}" (${task.priority}) بتاريخ استحقاق: ${due}.`,
        channel: "inApp",
        status: "sent",
        sent_at: new Date().toISOString(),
        meta_data: { type: "staff_task_created", task_id: task.id, link: "/work-hub?tab=calendar" },
      }));
      const { error } = await supabase.from("notifications").insert(rows as any);
      if (error) console.error("notify task error", error);
    } catch (e) {
      console.error("notify task error", e);
    }
  };

  const saveTask = async () => {
    if (!form.title.trim() || !form.due_date) return;
    setSaving(true);
    const payload: Record<string, any> = {
      title: form.title.trim(),
      description: form.description.trim() || null,
      category: form.category,
      priority: form.priority,
      status: form.status,
      due_date: form.due_date,
      due_time: form.due_time || null,
      assigned_by: session?.user?.id ?? null,
      assigned_to: form.assigned_to || null,
      assigned_to_role: form.assigned_to ? null : form.assigned_to_role || null,
      completed_at: form.status === "completed" ? new Date().toISOString() : null,
      reminder_at: computeReminderAt(form.due_date, form.due_time, form.reminder_value, form.reminder_unit),
      reminder_sent: false,
    };

    const { data, error } = await supabase.from("staff_tasks").insert(payload as any).select("id").single();
    setSaving(false);
    if (error) { toast.error("تعذّر إضافة المهمة"); return; }
    toast.success("تمت إضافة المهمة");
    setAddOpen(false);
    setForm(emptyForm);
    load();
    await notifyTaskCreated({
      id: (data as any)?.id,
      title: payload.title,
      due_date: payload.due_date,
      due_time: payload.due_time,
      priority: payload.priority,
      assigned_to: payload.assigned_to,
      assigned_to_role: payload.assigned_to_role,
    });
  };




  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-primary" /> التقويم الهجري — مخطِّط المهام
        </h2>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => openAdd(todayIso)} aria-label="إضافة مهمة جديدة">
            <Plus className="w-4 h-4 ml-1" /> مهمة جديدة
          </Button>

          <Button variant="outline" size="sm" onClick={() => syncOverdue(false)} disabled={syncing}
            aria-label="تحديث المهام المتأخرة">
            <RefreshCw className={`w-4 h-4 ml-1 ${syncing ? "animate-spin" : ""}`} /> تحديث المتأخرة
          </Button>
          <Button variant="ghost" size="icon" onClick={() => step(-1)} aria-label="الشهر السابق">
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => step(1)} aria-label="الشهر التالي">
            <ChevronLeft className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div>
          <Label className="text-xs">السنة الهجرية</Label>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="h-9 w-32"><SelectValue /></SelectTrigger>
            <SelectContent>{YEARS.map((y) => <SelectItem key={y} value={String(y)}>{y} هـ</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">الشهر</Label>
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              {HIJRI_MONTH_NAMES.map((n, i) => <SelectItem key={n} value={String(i + 1)}>{n}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Card><CardContent className="p-3 text-center">
          <p className="text-xl font-bold">{tasks.length}</p><p className="text-xs text-muted-foreground">مهام الشهر</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-xl font-bold text-destructive">{lateCount}</p><p className="text-xs text-muted-foreground">متأخرة</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-xl font-bold text-primary">{doneCount}</p><p className="text-xs text-muted-foreground">مكتملة</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-xl font-bold">{events.length}</p><p className="text-xs text-muted-foreground">فعاليات</p>
        </CardContent></Card>
      </div>

      <p className="text-sm font-medium text-center" aria-live="polite">
        {grid.label} — {formatGregorianArabic(grid.startIso)} إلى {formatGregorianArabic(grid.endIso)}
        {loading && <span className="text-muted-foreground"> · جارٍ التحميل...</span>}
      </p>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
        {WEEKDAYS.map((d) => <div key={d} className="py-1">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: grid.leadingBlanks }).map((_, i) => <div key={`b${i}`} />)}
        {grid.days.map((d) => {
          const dt = tasksByDay[d.iso] || [];
          const de = eventsByDay[d.iso] || [];
          const dh = holidaysFor(d.iso);
          const late = dt.filter((t) => isTaskLate(t, todayIso)).length;
          const isToday = d.iso === todayIso;
          return (
            <div
              key={d.iso}
              role="button"
              tabIndex={0}
              onClick={() => setOpenDay(d.iso)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpenDay(d.iso); } }}
              aria-label={`${d.hijriDay} ${HIJRI_MONTH_NAMES[month - 1]} — ${dt.length} مهمة`}
              className={`group relative min-h-[76px] cursor-pointer rounded-lg border p-1 text-right transition hover:bg-accent/50
                ${isToday ? "border-primary ring-1 ring-primary" : ""}
                ${dh.length ? "bg-amber-50 dark:bg-amber-950/20" : isWeekendDay(d.weekday) ? "bg-muted/40" : ""}`}
            >
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); openAdd(d.iso); }}
                aria-label={`إضافة مهمة في ${d.hijriDay} ${HIJRI_MONTH_NAMES[month - 1]}`}
                className="absolute bottom-1 left-1 rounded-md border bg-background p-0.5 opacity-0 transition group-hover:opacity-100 focus:opacity-100"
              >
                <Plus className="h-3 w-3" />
              </button>
              <div className="flex items-start justify-between">
                <span className="text-sm font-bold">{d.hijriDay}</span>

                <span className="text-[10px] text-muted-foreground">{d.gregorianDay}/{d.gregorianMonth}</span>
              </div>
              <div className="mt-1 space-y-0.5">
                {dh.slice(0, 1).map((h) => (
                  <p key={h.id} className="truncate text-[10px] text-amber-700 dark:text-amber-400">{h.title}</p>
                ))}
                {dt.slice(0, 2).map((t) => (
                  <p key={t.id} className={`truncate text-[10px] ${isTaskLate(t, todayIso) ? "text-destructive font-medium" : ""}`}>
                    • {t.title}
                  </p>
                ))}
                {de.slice(0, 1).map((e) => (
                  <p key={e.id} className="truncate text-[10px] text-primary">◆ {e.title}</p>
                ))}
                {dt.length + de.length > 3 && (
                  <p className="text-[10px] text-muted-foreground">+{dt.length + de.length - 3}</p>
                )}
                {late > 0 && (
                  <span className="inline-flex items-center gap-0.5 text-[10px] text-destructive">
                    <AlarmClock className="w-3 h-3" /> {late} متأخرة
                  </span>
                )}
              </div>
            </div>

          );
        })}
      </div>

      <Dialog open={!!openDay} onOpenChange={(o) => !o && setOpenDay(null)}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>{openDay ? formatDateSmart(openDay) : ""}</DialogTitle>
            <DialogDescription>مهام وفعاليات وإجازات هذا اليوم</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {dayHolidays.map((h) => (
              <div key={h.id} className="rounded-lg border bg-amber-50 dark:bg-amber-950/20 p-2 text-sm">
                إجازة: {h.title} ({formatDateSmart(h.start_date)} — {formatDateSmart(h.end_date)})
              </div>
            ))}
            {dayTasks.map((t) => (
              <div key={t.id} className="rounded-lg border p-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{t.title}</p>
                  <Badge variant={isTaskLate(t, todayIso) ? "destructive" : "secondary"}>
                    {isTaskLate(t, todayIso) ? "متأخرة" : STATUS_LABELS[t.status] || t.status}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t.category} · {t.priority}{t.due_time ? ` · ${t.due_time.slice(0, 5)}` : ""}
                </p>
              </div>
            ))}
            {dayEvents.map((e) => (
              <div key={e.id} className="rounded-lg border p-2">
                <p className="text-sm font-medium text-primary">{e.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  فعالية {e.event_type}{e.event_time ? ` · ${e.event_time.slice(0, 5)}` : ""}{e.location ? ` · ${e.location}` : ""}
                </p>
              </div>
            ))}
            {!dayHolidays.length && !dayTasks.length && !dayEvents.length && (
              <p className="text-sm text-muted-foreground text-center py-6">لا يوجد شيء في هذا اليوم</p>
            )}
          </div>
          <DialogFooter className="gap-2 sm:justify-start">
            <Button onClick={() => { if (openDay) { setOpenDay(null); openAdd(openDay); } }}>
              <Plus className="w-4 h-4 ml-1" /> إضافة مهمة في هذا اليوم
            </Button>
            <Button variant="outline" onClick={() => navigate("/work-hub?tab=tasks")}>إدارة المهام</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addOpen} onOpenChange={(o) => { setAddOpen(o); if (!o) setForm(emptyForm); }}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle>مهمة جديدة</DialogTitle>
            <DialogDescription>
              {form.due_date ? `تاريخ الاستحقاق: ${formatDateSmart(form.due_date)} (${formatGregorianArabic(form.due_date)})` : "اختر تاريخ الاستحقاق"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            <div>
              <Label className="text-xs">عنوان المهمة *</Label>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="اكتب عنوان المهمة" />
            </div>
            <div>
              <Label className="text-xs">الوصف</Label>
              <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">تاريخ الاستحقاق (ميلادي) *</Label>
                <Input type="date" value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">الوقت</Label>
                <Input type="time" value={form.due_time} onChange={(e) => setForm((f) => ({ ...f, due_time: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs">تذكير قبل الاستحقاق</Label>
                <Input
                  type="number" min={0} step={1}
                  value={form.reminder_value}
                  onChange={(e) => setForm((f) => ({ ...f, reminder_value: e.target.value }))}
                  aria-label="عدد الأيام أو الساعات قبل تاريخ الاستحقاق"
                />
              </div>
              <div>
                <Label className="text-xs">وحدة التذكير</Label>
                <Select value={form.reminder_unit} onValueChange={(v) => setForm((f) => ({ ...f, reminder_unit: v as "days" | "hours" }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="days">أيام</SelectItem>
                    <SelectItem value="hours">ساعات</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 -mt-1 text-xs text-muted-foreground">
                {computeReminderAt(form.due_date, form.due_time, form.reminder_value, form.reminder_unit)
                  ? `سيُرسل التذكير في: ${formatDateSmart(computeReminderAt(form.due_date, form.due_time, form.reminder_value, form.reminder_unit)!.slice(0, 10))} - ${new Date(computeReminderAt(form.due_date, form.due_time, form.reminder_value, form.reminder_unit)!).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit", hour12: true })}`
                  : "بدون تذكير (اجعل القيمة 0 لتعطيله)"}

              <div>
                <Label className="text-xs">الحالة</Label>
                <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {NEW_TASK_STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">الأولوية</Label>
                <Select value={form.priority} onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">التصنيف</Label>
                <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">تكليف موظف</Label>
                <Select value={form.assigned_to} onValueChange={(v) => setForm((f) => ({ ...f, assigned_to: v, assigned_to_role: "" }))}>
                  <SelectTrigger><SelectValue placeholder="اختر موظفاً" /></SelectTrigger>
                  <SelectContent>
                    {staff.map((p) => <SelectItem key={p.id} value={p.id}>{p.full_name || "بدون اسم"}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {!form.assigned_to && (
              <div>
                <Label className="text-xs">أو تكليف دور وظيفي</Label>
                <Select value={form.assigned_to_role} onValueChange={(v) => setForm((f) => ({ ...f, assigned_to_role: v, assigned_to: "" }))}>
                  <SelectTrigger><SelectValue placeholder="اختر الدور" /></SelectTrigger>
                  <SelectContent>
                    {roles.map((r) => <SelectItem key={r.name} value={r.name}>{r.name_ar || r.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:justify-start">
            <Button onClick={saveTask} disabled={saving || !form.title.trim() || !form.due_date}>
              {saving ? "جارٍ الحفظ..." : "حفظ المهمة"}
            </Button>
            <Button variant="outline" onClick={() => setAddOpen(false)}>إلغاء</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>

  );
}
