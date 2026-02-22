import { useState, useEffect } from "react";
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
  onSave: (data: NarrationAttemptData) => void;
  saving?: boolean;
}

export default function NarrationAttemptDialog({
  open,
  onClose,
  student,
  settings,
  existing,
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
    } else {
      setNarrationType("regular");
      setRanges([{ section: "regular", from_hizb: 1, to_hizb: 1, hizb_count: 1 }]);
      setMistakes(0);
      setLahn(0);
      setWarnings(0);
      setGrade(settings.max_grade);
      setManualEntry(false);
      setNotes("");
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

        <div className="space-y-4 pt-2">
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
