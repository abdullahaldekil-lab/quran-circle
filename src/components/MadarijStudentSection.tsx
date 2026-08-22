import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Eye, BookOpen, Pencil, Trash2, GraduationCap } from "lucide-react";
import { formatDateHijriOnly } from "@/lib/hijri";
import { toast } from "sonner";
import {
  DAILY_PACE_OPTIONS,
  addStudyDays,
  buildPaceSummary,
  commitmentTone,
  daysNeededFor,
  expandHolidayRanges,
  normalizePace,
  paceLabel,
  PAGES_PER_HIZB,
  PAGES_PER_JUZ,
} from "@/lib/madarij-pace";

interface Props {
  studentId: string;
  isManager: boolean;
}

/** أول حزب في الجزء (الجزء = حزبان). */
const hizbOfPart = (part: number) => Math.max(1, Math.min(60, part * 2 - 1));

const emptyForm = {
  track_id: "",
  level_track_id: "",
  branch_id: "",
  level_part_id: "",
  part_number: 1,
  hizb_number: 1,
  daily_pace: "1",
  days_planned: 20,
  start_date: new Date().toISOString().split("T")[0],
  end_date: "",
};

const MadarijStudentSection = ({ studentId, isManager }: Props) => {
  const navigate = useNavigate();
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [tracks, setTracks] = useState<any[]>([]);
  const [levels, setLevels] = useState<any[]>([]);
  const [branches, setBranches] = useState<any[]>([]);
  const [parts, setParts] = useState<any[]>([]);
  const [planHolidays, setPlanHolidays] = useState<string[]>([]);
  const [endDateManual, setEndDateManual] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [dailyRecords, setDailyRecords] = useState<any[]>([]);
  const [holidays, setHolidays] = useState<string[]>([]);
  const [form, setForm] = useState({ ...emptyForm });

  const activeEnrollment = enrollments.find((e) => e.status === "active") || null;
  const hasActiveEnrollment = !!activeEnrollment;

  const fetchEnrollments = async () => {
    const { data } = await supabase
      .from("madarij_enrollments")
      .select("*, madarij_tracks!madarij_enrollments_track_id_fkey(name, days_required), level_tracks(name, level_number), level_branches(branch_number)")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(20);
    setEnrollments(data || []);
  };

  const fetchMeta = async () => {
    const [tracksRes, levelsRes, holRes] = await Promise.all([
      supabase.from("madarij_tracks").select("*").eq("active", true),
      supabase.from("level_tracks").select("id, name, level_number").eq("active", true).order("sort_order").limit(20),
      supabase.from("holidays").select("start_date, end_date").order("start_date", { ascending: false }).limit(20),
    ]);
    setTracks(tracksRes.data || []);
    setLevels(levelsRes.data || []);
    setPlanHolidays(expandHolidayRanges(holRes.data || []));
  };

  useEffect(() => {
    fetchEnrollments();
    fetchMeta();
  }, [studentId]);

  // الفروع تتبع المستوى، والأجزاء تتبع الفرع
  useEffect(() => {
    if (!form.level_track_id) { setBranches([]); return; }
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("level_branches")
        .select("id, branch_number, description")
        .eq("level_track_id", form.level_track_id)
        .order("sort_order")
        .limit(20);
      if (alive) setBranches(data || []);
    })();
    return () => { alive = false; };
  }, [form.level_track_id]);

  useEffect(() => {
    if (!form.branch_id) { setParts([]); return; }
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from("level_parts")
        .select("id, part_number")
        .eq("branch_id", form.branch_id)
        .order("sort_order")
        .limit(20);
      if (alive) setParts(data || []);
    })();
    return () => { alive = false; };
  }, [form.branch_id]);

  // تاريخ النهاية يُحسب تلقائياً من عدد الأيام الدراسية إلا إذا عدّله المستخدم
  useEffect(() => {
    if (endDateManual) return;
    const auto = addStudyDays(form.start_date, Number(form.days_planned) || 0, planHolidays);
    setForm((f) => (auto && auto !== f.end_date ? { ...f, end_date: auto } : f));
  }, [form.start_date, form.days_planned, planHolidays, endDateManual]);

  // متابعة إنجاز مسار الحفظ للتسجيل النشط
  useEffect(() => {
    if (!activeEnrollment) {
      setDailyRecords([]);
      return;
    }
    let alive = true;
    (async () => {
      const today = new Date().toISOString().split("T")[0];
      const [dpRes, hRes] = await Promise.all([
        supabase
          .from("madarij_daily_progress")
          .select("progress_date, memorization")
          .eq("enrollment_id", activeEnrollment.id)
          .order("progress_date", { ascending: false })
          .limit(400),
        supabase
          .from("holidays")
          .select("start_date, end_date")
          .gte("end_date", activeEnrollment.start_date)
          .lte("start_date", today)
          .limit(20),
      ]);
      if (!alive) return;
      setDailyRecords(dpRes.data || []);
      setHolidays(expandHolidayRanges(hRes.data || []));
    })();
    return () => { alive = false; };
  }, [activeEnrollment?.id]);

  const paceSummary = activeEnrollment
    ? buildPaceSummary({
        pace: activeEnrollment.daily_pace,
        startDate: activeEnrollment.start_date,
        records: dailyRecords,
        holidays,
      })
    : null;

  const computeNextHizb = () => {
    const maxHizb = enrollments.reduce((m, e) => Math.max(m, Number(e.hizb_number) || 0), 0);
    const next = Math.min(60, maxHizb + 1 || 1);
    const part = Math.max(1, Math.min(30, Math.ceil(next / 2)));
    return { hizb_number: next, part_number: part };
  };

  const openNewDialog = () => {
    if (hasActiveEnrollment) {
      toast.error("لا يمكن تسجيل الطالب في أكثر من مسار نشط في نفس الوقت");
      return;
    }
    setEditingId(null);
    setEndDateManual(false);
    const auto = computeNextHizb();
    setForm({
      ...emptyForm,
      part_number: auto.part_number,
      hizb_number: auto.hizb_number,
      start_date: new Date().toISOString().split("T")[0],
    });
    setDialogOpen(true);
  };

  const openEditDialog = (en: any) => {
    setEditingId(en.id);
    setEndDateManual(!!en.end_date);
    setForm({
      track_id: en.track_id || "",
      level_track_id: en.level_track_id || "",
      branch_id: en.branch_id || "",
      level_part_id: en.level_part_id || "",
      part_number: en.part_number,
      hizb_number: en.hizb_number,
      daily_pace: String(normalizePace(en.daily_pace)),
      days_planned: Number(en.days_planned) || Number((en.madarij_tracks as any)?.days_required) || 20,
      start_date: en.start_date,
      end_date: en.end_date || "",
    });
    setDialogOpen(true);
  };

  /** عند اختيار المسار: عدد الأيام يُجلب من بيانات المسار */
  const onTrackChange = (trackId: string) => {
    const t = tracks.find((x) => x.id === trackId);
    setForm((f) => ({ ...f, track_id: trackId, days_planned: Number(t?.days_required) || f.days_planned }));
  };

  const onPartChange = (partId: string) => {
    const p = parts.find((x) => x.id === partId);
    const partNumber = Number(p?.part_number) || 1;
    setForm((f) => ({ ...f, level_part_id: partId, part_number: partNumber, hizb_number: hizbOfPart(partNumber) }));
  };

  const paceDays = daysNeededFor(PAGES_PER_JUZ, form.daily_pace);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const days = Number(form.days_planned) || 0;
    const endDate = form.end_date || addStudyDays(form.start_date, days, planHolidays);

    const payload = {
      track_id: form.track_id,
      level_track_id: form.level_track_id || null,
      branch_id: form.branch_id || null,
      level_part_id: form.level_part_id || null,
      part_number: form.part_number,
      hizb_number: form.hizb_number,
      daily_pace: normalizePace(form.daily_pace),
      days_planned: days || null,
      start_date: form.start_date,
      end_date: endDate,
    };

    if (editingId) {
      const { error } = await supabase.from("madarij_enrollments").update(payload).eq("id", editingId);
      if (error) { toast.error("خطأ في تحديث التسجيل"); return; }
      toast.success("تم تحديث التسجيل بنجاح");
    } else {
      const { data: existing } = await supabase
        .from("madarij_enrollments")
        .select("id")
        .eq("student_id", studentId)
        .eq("status", "active")
        .limit(1);

      if (existing && existing.length > 0) {
        toast.error("الطالب مسجل بالفعل في مسار نشط. يرجى إنهاء المسار الحالي أولاً");
        return;
      }

      const { error } = await supabase.from("madarij_enrollments").insert({ student_id: studentId, ...payload });
      if (error) { toast.error("خطأ في التسجيل"); return; }
      toast.success("تم التسجيل في برنامج مدارج");
    }

    setDialogOpen(false);
    setEditingId(null);
    fetchEnrollments();
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    const { error } = await supabase.from("madarij_enrollments").delete().eq("id", deleteId);
    if (error) { toast.error("خطأ في حذف التسجيل"); return; }
    toast.success("تم حذف التسجيل بنجاح");
    setDeleteId(null);
    fetchEnrollments();
  };

  const toneClass = (pct: number) => {
    const tone = commitmentTone(pct);
    return tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : "text-destructive";
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary" />
          برنامج مدارج
        </CardTitle>
        {isManager && (
          <Button size="sm" onClick={openNewDialog} disabled={hasActiveEnrollment}>
            <Plus className="w-4 h-4 ml-1" />
            تسجيل جديد
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {hasActiveEnrollment && isManager && (
          <p className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 rounded p-2 mb-3">
            ⚠️ الطالب مسجل في مسار نشط حالياً. لا يمكن التسجيل في مسار آخر حتى يكتمل الحالي.
          </p>
        )}

        {/* مسار الحفظ داخل برنامج مدارج */}
        {activeEnrollment && paceSummary && (
          <div className="rounded-lg border bg-muted/30 p-3 mb-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-medium text-sm">
                <GraduationCap className="w-4 h-4 text-primary" />
                مسار الحفظ
              </div>
              <Badge variant="secondary" className="text-xs">{paceLabel(activeEnrollment.daily_pace)}</Badge>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="rounded-md bg-background p-2">
                <div className="text-muted-foreground">المقدار اليومي</div>
                <div className="font-semibold">{paceSummary.dailyPages} وجه</div>
              </div>
              <div className="rounded-md bg-background p-2">
                <div className="text-muted-foreground">إتمام الحزب ({PAGES_PER_HIZB} أوجه)</div>
                <div className="font-semibold">{paceSummary.daysForHizb} يوم</div>
              </div>
              <div className="rounded-md bg-background p-2">
                <div className="text-muted-foreground">إتمام الجزء ({PAGES_PER_JUZ} وجهاً)</div>
                <div className="font-semibold">{paceSummary.daysForJuz} يوم</div>
              </div>
              <div className="rounded-md bg-background p-2">
                <div className="text-muted-foreground">الانتهاء المتوقع للحزب</div>
                <div className="font-semibold">
                  {paceSummary.expectedHizbEnd ? formatDateHijriOnly(paceSummary.expectedHizbEnd) : "—"}
                </div>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  المنجز {paceSummary.achieved} من {paceSummary.targetToDate} وجه حتى اليوم
                </span>
                <span className={`font-semibold ${toneClass(paceSummary.commitment)}`}>
                  {paceSummary.commitment}%
                </span>
              </div>
              <Progress value={Math.min(100, paceSummary.commitment)} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {paceSummary.daysAhead >= 0
                  ? `متقدم عن الخطة بـ ${paceSummary.daysAhead} يوم`
                  : `متأخر عن الخطة بـ ${Math.abs(paceSummary.daysAhead)} يوم`}
              </p>
            </div>
          </div>
        )}

        {enrollments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">لا يوجد تسجيل في برنامج مدارج</p>
        ) : (
          <div className="space-y-3">
            {enrollments.map((en) => (
              <div key={en.id} className="flex items-center justify-between py-2 border-b last:border-0">
                <div>
                  <p className="text-sm font-medium">{(en.madarij_tracks as any)?.name} — الجزء {en.part_number} / الحزب {en.hizb_number}</p>
                  <p className="text-xs text-muted-foreground">
                    {(en.level_tracks as any)?.name ? `${(en.level_tracks as any).name} • ` : ""}
                    {(en.level_branches as any)?.branch_number ? `الفرع ${(en.level_branches as any).branch_number} • ` : ""}
                    {en.days_planned ? `${en.days_planned} يوم • ` : ""}
                    {formatDateHijriOnly(en.start_date)} → {en.end_date ? formatDateHijriOnly(en.end_date) : "—"} • {paceLabel(en.daily_pace)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={en.status === "active" ? "default" : "secondary"} className="text-xs">
                    {en.status === "active" ? "نشط" : "مكتمل"}
                  </Badge>
                  {isManager && en.status === "active" && (
                    <>
                      <Button aria-label="تعديل" variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDialog(en)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button aria-label="حذف" variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeleteId(en.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                  <Button aria-label="عرض التفاصيل" variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(`/madarij/${en.id}`)}>
                    <Eye className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={(v) => { setDialogOpen(v); if (!v) setEditingId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "تعديل التسجيل" : "تسجيل جديد في برنامج مدارج"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>المسار</Label>
                <Select value={form.track_id} onValueChange={onTrackChange} required>
                  <SelectTrigger><SelectValue placeholder="اختر المسار" /></SelectTrigger>
                  <SelectContent>
                    {tracks.map(t => <SelectItem key={t.id} value={t.id}>{t.name} ({t.days_required} يوم)</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>المستوى</Label>
                <Select
                  value={form.level_track_id}
                  onValueChange={v => setForm({ ...form, level_track_id: v, branch_id: "", level_part_id: "" })}
                >
                  <SelectTrigger><SelectValue placeholder="اختر المستوى" /></SelectTrigger>
                  <SelectContent>
                    {levels.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>الفرع</Label>
                <Select
                  value={form.branch_id}
                  onValueChange={v => setForm({ ...form, branch_id: v, level_part_id: "" })}
                  disabled={!form.level_track_id}
                >
                  <SelectTrigger><SelectValue placeholder={form.level_track_id ? "اختر الفرع" : "اختر المستوى أولاً"} /></SelectTrigger>
                  <SelectContent>
                    {branches.map(b => <SelectItem key={b.id} value={b.id}>الفرع {b.branch_number}{b.description ? ` — ${b.description}` : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>الجزء</Label>
                <Select value={form.level_part_id} onValueChange={onPartChange} disabled={!form.branch_id}>
                  <SelectTrigger><SelectValue placeholder={form.branch_id ? "اختر الجزء" : "اختر الفرع أولاً"} /></SelectTrigger>
                  <SelectContent>
                    {parts.map(p => <SelectItem key={p.id} value={p.id}>الجزء {p.part_number}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <div className="font-medium mb-1">الحزب (تلقائي)</div>
              <div className="text-muted-foreground">
                الجزء <span className="font-semibold text-foreground">{form.part_number}</span> — الحزب <span className="font-semibold text-foreground">{form.hizb_number}</span>
                {!form.level_part_id && <span className="block text-xs mt-1">يُحدَّد تلقائياً عند اختيار الجزء (الجزء = حزبان)</span>}
              </div>
            </div>

            <div className="space-y-1">
              <Label>مسار الحفظ (السرعة اليومية)</Label>
              <Select value={form.daily_pace} onValueChange={v => setForm({...form, daily_pace: v})}>
                <SelectTrigger><SelectValue placeholder="اختر السرعة" /></SelectTrigger>
                <SelectContent>
                  {DAILY_PACE_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                إتمام الحزب في {Math.ceil(PAGES_PER_HIZB / normalizePace(form.daily_pace))} يوماً دراسياً،
                والجزء في {paceDays} يوماً.
              </p>
              {Number(form.days_planned) > 0 && paceDays !== Number(form.days_planned) && (
                <p className="text-xs text-amber-600">
                  ⚠️ الأيام المقررة {form.days_planned} يوماً تختلف عن الأيام المحسوبة من السرعة ({paceDays} يوماً).
                </p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>الأيام</Label>
                <Input
                  type="number" min={1} max={365}
                  value={form.days_planned}
                  onChange={e => setForm({ ...form, days_planned: Number(e.target.value) })}
                  required
                />
              </div>
              <div className="space-y-1">
                <Label>تاريخ البداية</Label>
                <Input type="date" value={form.start_date} onChange={e => setForm({...form, start_date: e.target.value})} required />
              </div>
              <div className="space-y-1">
                <Label>تاريخ النهاية</Label>
                <Input
                  type="date"
                  value={form.end_date}
                  onChange={e => { setEndDateManual(true); setForm({ ...form, end_date: e.target.value }); }}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              تاريخ النهاية محسوب تلقائياً بأيام الدراسة (الأحد–الخميس) مع استثناء الإجازات الرسمية:
              {" "}<span className="font-medium text-foreground">{form.end_date ? formatDateHijriOnly(form.end_date) : "—"}</span>
              {endDateManual && " (معدَّل يدوياً)"}
            </p>
            <Button type="submit" className="w-full">{editingId ? "حفظ التعديلات" : "تسجيل"}</Button>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog open={!!deleteId} onOpenChange={(v) => { if (!v) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد حذف التسجيل</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف هذا التسجيل؟ سيتم حذف جميع بيانات المتابعة المرتبطة به. لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default MadarijStudentSection;
