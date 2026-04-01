import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toHijri } from "@/lib/hijri";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Target, BookOpen, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
}

interface MonthRow {
  month: number;
  monthName: string;
  workDays: number;
  targetPages: number;
}

const PLAN_TYPES = [
  { value: "silver", label: "🥈 المسار الفضي", daily: 0.5, yearly: 100, desc: "نصف وجه يومياً" },
  { value: "gold", label: "🥇 المسار الذهبي", daily: 1, yearly: 200, desc: "وجه كامل يومياً" },
  { value: "custom", label: "⚙️ مخصص", daily: 0, yearly: 0, desc: "هدف يدوي" },
];

const HIJRI_MONTHS = [
  "محرم", "صفر", "ربيع الأول", "ربيع الثاني", "جمادى الأولى", "جمادى الآخرة",
  "رجب", "شعبان", "رمضان", "شوال", "ذو القعدة", "ذو الحجة",
];

const AnnualPlanDialog = ({ open, onOpenChange, onSaved }: Props) => {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Step 1
  const [halaqat, setHalaqat] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedHalaqa, setSelectedHalaqa] = useState("");
  const [selectedStudent, setSelectedStudent] = useState("");
  const [planType, setPlanType] = useState("silver");
  const [customDaily, setCustomDaily] = useState(1);

  // Step 2
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState("");
  const [workingDays, setWorkingDays] = useState(5);
  const [holidays, setHolidays] = useState<any[]>([]);
  const [summary, setSummary] = useState({ totalWorkDays: 0, totalPages: 0, dailyPages: 0 });

  // Step 3
  const [monthlyDistribution, setMonthlyDistribution] = useState<MonthRow[]>([]);

  useEffect(() => {
    if (open) {
      setStep(1);
      fetchHalaqat();
      fetchHolidays();
    }
  }, [open]);

  useEffect(() => {
    if (selectedHalaqa) fetchStudents();
  }, [selectedHalaqa]);

  useEffect(() => {
    if (startDate && planType) calculateSummary();
  }, [startDate, endDate, workingDays, planType, customDaily, holidays]);

  const fetchHalaqat = async () => {
    const { data } = await supabase.from("halaqat").select("id, name").eq("active", true).order("name");
    setHalaqat(data || []);
  };

  const fetchStudents = async () => {
    const { data } = await supabase.from("students").select("id, full_name").eq("halaqa_id", selectedHalaqa).eq("status", "active").order("full_name");
    setStudents(data || []);
  };

  const fetchHolidays = async () => {
    const { data } = await supabase.from("holidays").select("*");
    setHolidays(data || []);
  };

  const getDailyTarget = () => {
    if (planType === "custom") return customDaily;
    return PLAN_TYPES.find(p => p.value === planType)?.daily || 0.5;
  };

  const isHoliday = (date: Date) => {
    const dateStr = date.toISOString().split("T")[0];
    return holidays.some(h => dateStr >= h.start_date && dateStr <= h.end_date);
  };

  const isWeekend = (date: Date) => {
    const day = date.getDay();
    return day === 5 || day === 6; // Friday & Saturday
  };

  const countWorkDays = (from: Date, to: Date) => {
    let count = 0;
    const current = new Date(from);
    while (current <= to) {
      if (!isWeekend(current) && !isHoliday(current)) count++;
      current.setDate(current.getDate() + 1);
    }
    return count;
  };

  const calculateSummary = () => {
    const daily = getDailyTarget();
    const start = new Date(startDate);

    let end: Date;
    if (endDate) {
      end = new Date(endDate);
    } else {
      // Auto-calculate: ~200 working days
      const targetDays = planType === "custom" ? 200 : (PLAN_TYPES.find(p => p.value === planType)?.yearly || 100) / daily;
      end = new Date(start);
      let daysAdded = 0;
      while (daysAdded < targetDays) {
        end.setDate(end.getDate() + 1);
        if (!isWeekend(end) && !isHoliday(end)) daysAdded++;
      }
      setEndDate(end.toISOString().split("T")[0]);
    }

    const totalWorkDays = countWorkDays(start, end);
    const totalPages = Math.round(totalWorkDays * daily);

    setSummary({ totalWorkDays, totalPages, dailyPages: daily });
  };

  const generateMonthlyDistribution = () => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const daily = getDailyTarget();
    const months: MonthRow[] = [];

    const current = new Date(start);
    current.setDate(1);

    let monthIndex = 0;
    while (current <= end) {
      const monthStart = new Date(Math.max(current.getTime(), start.getTime()));
      const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);
      const effectiveEnd = new Date(Math.min(monthEnd.getTime(), end.getTime()));

      const workDays = countWorkDays(monthStart, effectiveEnd);
      const targetPages = Math.round(workDays * daily);

      if (workDays > 0) {
        months.push({
          month: monthIndex + 1,
          monthName: current.toLocaleDateString("ar-SA", { month: "long", year: "numeric" }),
          workDays,
          targetPages,
        });
        monthIndex++;
      }

      current.setMonth(current.getMonth() + 1);
      current.setDate(1);
    }

    setMonthlyDistribution(months);
  };

  const handleNext = () => {
    if (step === 1) {
      if (!selectedHalaqa || !selectedStudent) {
        toast.error("يرجى اختيار الحلقة والطالب");
        return;
      }
      calculateSummary();
      setStep(2);
    } else if (step === 2) {
      if (!startDate || !endDate) {
        toast.error("يرجى تحديد التواريخ");
        return;
      }
      generateMonthlyDistribution();
      setStep(3);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: plan, error: planError } = await supabase
        .from("student_annual_plans")
        .insert({
          student_id: selectedStudent,
          halaqa_id: selectedHalaqa,
          academic_year: `${new Date(startDate).getFullYear()}-${new Date(startDate).getFullYear() + 1}`,
          plan_type: planType,
          start_date: startDate,
          end_date: endDate,
          total_target_pages: summary.totalPages,
          daily_target_pages: summary.dailyPages,
          working_days_per_week: workingDays,
          status: "active",
          created_by: user?.id,
        })
        .select()
        .single();

      if (planError) throw planError;

      // Insert monthly progress rows
      const progressRows = monthlyDistribution.map((m) => ({
        plan_id: plan.id,
        student_id: selectedStudent,
        week_number: 0,
        month_number: m.month,
        target_pages: m.targetPages,
        actual_pages: 0,
        attendance_days: m.workDays,
        commitment_percentage: 0,
        status: "on_track",
      }));

      if (progressRows.length > 0) {
        const { error: progressError } = await supabase.from("student_plan_progress").insert(progressRows);
        if (progressError) throw progressError;
      }

      toast.success("تم حفظ الخطة السنوية بنجاح");
      onOpenChange(false);
      onSaved();
    } catch (error: any) {
      toast.error("خطأ في حفظ الخطة: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const updateMonthTarget = (index: number, value: number) => {
    setMonthlyDistribution(prev => prev.map((m, i) => i === index ? { ...m, targetPages: value } : m));
  };

  const totalDistributed = monthlyDistribution.reduce((sum, m) => sum + m.targetPages, 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-primary" />
            إنشاء خطة سنوية — الخطوة {step} من 3
          </DialogTitle>
        </DialogHeader>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-2 mb-4">
          {[1, 2, 3].map((s) => (
            <div key={s} className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${s === step ? "bg-primary text-primary-foreground" : s < step ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
              {s}
            </div>
          ))}
        </div>

        {/* Step 1: Select Student & Plan Type */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>الحلقة</Label>
              <Select value={selectedHalaqa} onValueChange={(v) => { setSelectedHalaqa(v); setSelectedStudent(""); }}>
                <SelectTrigger><SelectValue placeholder="اختر الحلقة" /></SelectTrigger>
                <SelectContent>
                  {halaqat.map(h => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>الطالب</Label>
              <Select value={selectedStudent} onValueChange={setSelectedStudent} disabled={!selectedHalaqa}>
                <SelectTrigger><SelectValue placeholder="اختر الطالب" /></SelectTrigger>
                <SelectContent>
                  {students.map(s => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>نوع الخطة</Label>
              <div className="grid grid-cols-1 gap-2">
                {PLAN_TYPES.map((pt) => (
                  <Card
                    key={pt.value}
                    className={`cursor-pointer transition-all ${planType === pt.value ? "ring-2 ring-primary bg-primary/5" : "hover:bg-muted/50"}`}
                    onClick={() => setPlanType(pt.value)}
                  >
                    <CardContent className="p-3 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{pt.label}</p>
                        <p className="text-xs text-muted-foreground">{pt.desc}</p>
                      </div>
                      {pt.value !== "custom" && (
                        <Badge variant="secondary">{pt.yearly} وجه/سنة</Badge>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {planType === "custom" && (
              <div className="space-y-2">
                <Label>الهدف اليومي (عدد الأوجه)</Label>
                <Input type="number" min={0.25} step={0.25} value={customDaily} onChange={(e) => setCustomDaily(Number(e.target.value))} />
              </div>
            )}
          </div>
        )}

        {/* Step 2: Configure Plan */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>تاريخ البداية</Label>
                <Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setEndDate(""); }} />
              </div>
              <div className="space-y-2">
                <Label>تاريخ النهاية (تلقائي)</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>أيام الدوام في الأسبوع</Label>
              <Select value={String(workingDays)} onValueChange={(v) => setWorkingDays(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[4, 5, 6].map(d => <SelectItem key={d} value={String(d)}>{d} أيام</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <p className="text-xs text-muted-foreground">
              * يتم خصم العطل الرسمية تلقائياً ({holidays.length} عطلة مسجلة)
            </p>

            {/* Summary */}
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-4 space-y-2">
                <h4 className="font-semibold text-sm flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" /> ملخص الخطة
                </h4>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div>
                    <p className="text-xl font-bold text-primary">{summary.totalWorkDays}</p>
                    <p className="text-xs text-muted-foreground">أيام العمل</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-primary">{summary.totalPages}</p>
                    <p className="text-xs text-muted-foreground">إجمالي الأوجه</p>
                  </div>
                  <div>
                    <p className="text-xl font-bold text-primary">{summary.dailyPages}</p>
                    <p className="text-xs text-muted-foreground">أوجه/يوم</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Step 3: Monthly Distribution */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary" /> التوزيع الشهري
              </h4>
              <Badge variant={totalDistributed === summary.totalPages ? "default" : "destructive"}>
                المجموع: {totalDistributed} / {summary.totalPages}
              </Badge>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>الشهر</TableHead>
                  <TableHead>أيام العمل</TableHead>
                  <TableHead>الأوجه المستهدفة</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlyDistribution.map((m, i) => (
                  <TableRow key={i}>
                    <TableCell>{m.month}</TableCell>
                    <TableCell className="font-medium">{m.monthName}</TableCell>
                    <TableCell>{m.workDays}</TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        min={0}
                        className="w-20 h-8"
                        value={m.targetPages}
                        onChange={(e) => updateMonthTarget(i, Number(e.target.value))}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between pt-4 border-t">
          {step > 1 ? (
            <Button variant="outline" onClick={() => setStep(step - 1)}>
              <ChevronRight className="w-4 h-4 ml-1" /> السابق
            </Button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <Button onClick={handleNext}>
              التالي <ChevronLeft className="w-4 h-4 mr-1" />
            </Button>
          ) : (
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "جارٍ الحفظ..." : "حفظ الخطة"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AnnualPlanDialog;
