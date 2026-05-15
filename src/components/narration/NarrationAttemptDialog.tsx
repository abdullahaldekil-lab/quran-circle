import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import NarrationTypeSelector from "./NarrationTypeSelector";
import RegularNarrationForm from "./RegularNarrationForm";
import MultiNarrationForm from "./MultiNarrationForm";
import {
  type NarrationRange,
  type NarrationSettingsFull,
  calcTotalHizbCount,
  calcTotalPages,
  calcGrade,
  determineStatus,
  validateAttempt,
  type NarrationAttemptData,
} from "./NarrationValidation";

interface StudentInfo {
  student_id: string;
  student_name: string;
}

interface StudentPlanInfo {
  totalHizb: number;
  fromHizb: string;
  toHizb: string;
}

interface ExistingAttempt {
  id: string;
  narration_type: "regular" | "multi";
  ranges: NarrationRange[];
  mistakes_count: number;
  lahn_count: number;
  warnings_count: number;
  grade: number;
  status: "pass" | "fail" | "absent" | "pending";
  manual_entry: boolean;
  notes: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  student: StudentInfo;
  settings: NarrationSettingsFull;
  existing?: ExistingAttempt | null;
  studentPlanInfo?: StudentPlanInfo | null;
  onSave: (data: NarrationAttemptData) => void;
  saving?: boolean;
}

export default function NarrationAttemptDialog({
  open,
  onClose,
  student,
  settings,
  existing,
  studentPlanInfo,
  onSave,
  saving,
}: Props) {
  const { toast } = useToast();
  const [narrationType, setNarrationType] = useState<"regular" | "multi">("regular");
  const [ranges, setRanges] = useState<NarrationRange[]>([
    { section: "regular", from_hizb: 1, to_hizb: 1, hizb_count: 1 },
  ]);
  const [mistakes, setMistakes] = useState(0);
  const [lahn, setLahn] = useState(0);
  const [warnings, setWarnings] = useState(0);
  const [grade, setGrade] = useState(settings.max_grade);
  const [manualEntry, setManualEntry] = useState(false);
  const [notes, setNotes] = useState("");
  const [segmentLabel, setSegmentLabel] = useState("");
  const [isPartial, setIsPartial] = useState(false);

  // Timer state
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const startTimer = () => {
    setTimerRunning(true);
    timerRef.current = setInterval(() => setTimerSeconds((prev) => prev + 1), 1000);
  };
  const pauseTimer = () => {
    setTimerRunning(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };
  const stopTimer = () => {
    pauseTimer();
    setTimerSeconds(0);
  };

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  useEffect(() => {
    // Reset timer when dialog opens/closes or student changes
    setTimerSeconds(0);
    setTimerRunning(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }, [open, student.student_id]);

  // Load existing data
  useEffect(() => {
    if (existing) {
      setNarrationType(existing.narration_type);
      setRanges(existing.ranges.length > 0 ? existing.ranges : [
        { section: "regular", from_hizb: 1, to_hizb: 1, hizb_count: 1 },
      ]);
      setMistakes(existing.mistakes_count);
      setLahn(existing.lahn_count);
      setWarnings(existing.warnings_count);
      setGrade(existing.grade);
      setManualEntry(existing.manual_entry);
      setNotes(existing.notes || "");
      setSegmentLabel((existing as any).segment_label || "");
      setIsPartial((existing as any).is_partial || false);
    } else {
      setNarrationType("regular");
      setRanges([{ section: "regular", from_hizb: 1, to_hizb: 1, hizb_count: 1 }]);
      setMistakes(0);
      setLahn(0);
      setWarnings(0);
      setGrade(settings.max_grade);
      setManualEntry(false);
      setNotes("");
      setSegmentLabel("");
      setIsPartial(false);
    }
  }, [existing, open, settings.max_grade]);

  // Auto-calc grade
  useEffect(() => {
    if (!manualEntry) {
      const g = calcGrade(settings, mistakes, lahn, warnings);
      setGrade(g);
    }
  }, [mistakes, lahn, warnings, manualEntry, settings]);

  const totalHizb = calcTotalHizbCount(ranges);
  const totalPages = calcTotalPages(totalHizb, settings.pages_per_hizb);
  const status = determineStatus(grade, settings.min_grade);

  const handleTypeChange = (type: "regular" | "multi") => {
    setNarrationType(type);
    if (type === "regular") {
      setRanges([{ section: "regular", from_hizb: 1, to_hizb: 1, hizb_count: 1 }]);
    } else {
      setRanges([]);
    }
  };

  const handleSave = () => {
    const attemptData: NarrationAttemptData = {
      narration_type: narrationType,
      ranges,
      total_hizb_count: totalHizb,
      total_pages_approx: totalPages,
      mistakes_count: mistakes,
      lahn_count: lahn,
      warnings_count: warnings,
      grade,
      status,
      manual_entry: manualEntry,
      notes,
      recitation_duration_seconds: timerSeconds > 0 ? timerSeconds : undefined,
      is_partial: isPartial,
      segment_label: segmentLabel || null,
    };

    if (!manualEntry) {
      const errors = validateAttempt(attemptData, settings);
      if (errors.length > 0) {
        toast({ title: errors[0], variant: "destructive" });
        return;
      }
    }

    onSave(attemptData);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            إدخال نتيجة سرد — {student.student_name}
          </DialogTitle>
        </DialogHeader>

        {/* Timer */}
        <div className="flex flex-col items-center gap-3 p-4 rounded-xl border bg-card mb-2">
          <span className={`text-4xl font-mono font-bold tabular-nums ${
            timerRunning ? 'text-green-600' : timerSeconds > 0 ? 'text-yellow-600' : 'text-muted-foreground'
          }`}>{formatTime(timerSeconds)}</span>
          <div className="flex gap-2">
            {!timerRunning && timerSeconds === 0 && (
              <Button size="sm" onClick={startTimer} className="bg-green-600 hover:bg-green-700 text-white">
                ▶ ابدأ التوقيت
              </Button>
            )}
            {timerRunning && (
              <Button size="sm" variant="outline" onClick={pauseTimer}>⏸ إيقاف مؤقت</Button>
            )}
            {!timerRunning && timerSeconds > 0 && (
              <>
                <Button size="sm" onClick={startTimer} className="bg-green-600 hover:bg-green-700 text-white">▶ استئناف</Button>
                <Button size="sm" variant="outline" onClick={stopTimer}>⏹ إعادة تعيين</Button>
              </>
            )}
          </div>
        </div>

        <div className="space-y-4 pt-2">
          {/* Plan Info Card */}
          {studentPlanInfo && (
            <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 border border-green-200">
              <div>
                <p className="text-sm font-semibold text-green-800">
                  الأحزاب المجتازة: {studentPlanInfo.totalHizb} حزب
                </p>
                <p className="text-xs text-green-700 mt-0.5">
                  من: {studentPlanInfo.fromHizb} — إلى: {studentPlanInfo.toHizb}
                </p>
              </div>
              <Button
                size="sm"
                className="bg-green-700 hover:bg-green-800 text-white"
                onClick={() => {
                  const fromNum = parseInt(studentPlanInfo.fromHizb, 10);
                  const toNum = parseInt(studentPlanInfo.toHizb, 10);
                  if (!isNaN(fromNum) && !isNaN(toNum) && fromNum >= 1 && toNum <= 60) {
                    if (narrationType === "regular") {
                      setRanges([{ section: "regular", from_hizb: fromNum, to_hizb: toNum, hizb_count: toNum - fromNum + 1 }]);
                    }
                  }
                }}
              >
                تطبيق
              </Button>
            </div>
          )}

          {/* Reviewer Settings — multi-reviewer support */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-amber-700" />
              <p className="text-sm font-semibold text-amber-800">إعدادات المسمع</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">المقطع / الجزء</Label>
                <Input
                  placeholder="مثال: الربع الأول"
                  value={segmentLabel}
                  onChange={(e) => setSegmentLabel(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs">هذا تقييم جزئي؟</Label>
                <div className="flex items-center gap-2 mt-1">
                  <Switch checked={isPartial} onCheckedChange={setIsPartial} />
                  <span className="text-xs text-muted-foreground">
                    {isPartial ? "نعم — سيُكمل مسمع آخر" : "لا — تقييم كامل"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Narration Type */}
          <NarrationTypeSelector value={narrationType} onChange={handleTypeChange} />

          {/* Ranges */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">نطاقات الأحزاب</Label>
            {narrationType === "regular" ? (
              <RegularNarrationForm
                range={ranges[0] || { section: "regular", from_hizb: 1, to_hizb: 1, hizb_count: 1 }}
                onChange={(r) => setRanges([r])}
                pagesPerHizb={settings.pages_per_hizb}
              />
            ) : (
              <MultiNarrationForm
                ranges={ranges}
                onChange={setRanges}
                pagesPerHizb={settings.pages_per_hizb}
              />
            )}
          </div>

          {/* Assessment */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">أخطاء</Label>
              <Input
                type="number"
                min={0}
                value={mistakes}
                onChange={(e) => setMistakes(Number(e.target.value))}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">لحون</Label>
              <Input
                type="number"
                min={0}
                value={lahn}
                onChange={(e) => setLahn(Number(e.target.value))}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">تنبيهات</Label>
              <Input
                type="number"
                min={0}
                value={warnings}
                onChange={(e) => setWarnings(Number(e.target.value))}
                className="h-9"
              />
            </div>
          </div>

          {/* Grade & Manual */}
          <div className="flex items-center gap-4">
            <div className="flex-1 space-y-1.5">
              <Label className="text-xs">الدرجة</Label>
              <Input
                type="number"
                min={0}
                max={settings.max_grade}
                value={grade}
                onChange={(e) => {
                  setManualEntry(true);
                  setGrade(Number(e.target.value));
                }}
                className="h-9"
              />
            </div>
            <div className="flex items-center gap-2 pt-5">
              <Switch
                checked={manualEntry}
                onCheckedChange={setManualEntry}
                id="manual"
              />
              <Label htmlFor="manual" className="text-xs">يدوي</Label>
            </div>
            <div className="pt-5">
              <Badge variant={status === "pass" ? "default" : "destructive"}>
                {status === "pass" ? "ناجح" : "راسب"}
              </Badge>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs">ملاحظات</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="ملاحظات اختيارية..."
            />
          </div>

          {/* Summary */}
          <div className="flex items-center gap-2 p-2 bg-muted/50 rounded-md text-xs">
            <span>الأحزاب: <strong>{totalHizb}</strong></span>
            <span>|</span>
            <span>الأوجه: <strong>{totalPages}</strong></span>
            <span>|</span>
            <span>الدرجة: <strong>{grade}</strong> / {settings.max_grade}</span>
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose}>إلغاء</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "جارٍ الحفظ..." : "حفظ"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
