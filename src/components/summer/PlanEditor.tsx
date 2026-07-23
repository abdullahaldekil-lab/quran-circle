import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PLAN_TRACKS, type PlanType } from "@/lib/summer-scoring";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatDateTimeSmart } from "@/lib/hijri";
import { History, ArrowLeft, User } from "lucide-react";

interface ChangeLog {
  id: string;
  old_plan_type: string | null;
  new_plan_type: string | null;
  old_plan_track: string | null;
  new_plan_track: string | null;
  old_plan_goal: string | null;
  new_plan_goal: string | null;
  old_assigned_reciter: string | null;
  new_assigned_reciter: string | null;
  changed_by_name: string | null;
  created_at: string;
}

const PLAN_LABEL: Record<string, string> = { hifz: "حفظ", taahud: "تعاهد" };

function fieldRow(label: string, oldVal: string | null, newVal: string | null) {
  if ((oldVal || "") === (newVal || "")) return null;
  return (
    <div className="flex items-center gap-2 text-xs flex-wrap">
      <span className="text-muted-foreground min-w-16">{label}:</span>
      <Badge variant="outline" className="text-xs">{oldVal || "—"}</Badge>
      <ArrowLeft className="w-3 h-3 text-muted-foreground rtl:rotate-180" />
      <Badge variant="secondary" className="text-xs">{newVal || "—"}</Badge>
    </div>
  );
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  summerStudentId: string;
  studentName: string;
  initial: {
    plan_type?: PlanType | null;
    plan_track?: string | null;
    plan_goal?: string | null;
    assigned_reciter?: string | null;
  };
  onSaved: () => void;
}

export default function PlanEditor({ open, onOpenChange, summerStudentId, studentName, initial, onSaved }: Props) {
  const [planType, setPlanType] = useState<PlanType>(initial.plan_type || "hifz");
  const [track, setTrack] = useState(initial.plan_track || "");
  const [goal, setGoal] = useState(initial.plan_goal || "");
  const [reciter, setReciter] = useState(initial.assigned_reciter || "");
  const [saving, setSaving] = useState(false);
  const [logs, setLogs] = useState<ChangeLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  useEffect(() => {
    setPlanType(initial.plan_type || "hifz");
    setTrack(initial.plan_track || "");
    setGoal(initial.plan_goal || "");
    setReciter(initial.assigned_reciter || "");
  }, [summerStudentId, open]);

  const tracks = PLAN_TRACKS[planType];

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("summer_students").update({
      plan_type: planType,
      plan_track: track || null,
      plan_goal: goal || null,
      assigned_reciter: reciter || null,
    }).eq("id", summerStudentId);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("تم حفظ الخطة");
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl">
        <DialogHeader><DialogTitle>خطة الطالب — {studentName}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>نوع الخطة</Label>
            <Select value={planType} onValueChange={(v) => { setPlanType(v as PlanType); setTrack(""); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="hifz">حفظ (بطاقة الحفظ)</SelectItem>
                <SelectItem value="taahud">تعاهد / إتقان (دورة تعاهد)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>المسار</Label>
            <Select value={track} onValueChange={setTrack}>
              <SelectTrigger><SelectValue placeholder="اختر المسار" /></SelectTrigger>
              <SelectContent>
                {tracks.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>المقرئ المرافق</Label><Input value={reciter} onChange={(e) => setReciter(e.target.value)} placeholder="اسم المقرئ" /></div>
          <div><Label>هدف الدورة</Label><Textarea value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="سأضبط ..." /></div>
        </div>
        <DialogFooter><Button onClick={save} disabled={saving}>{saving ? "جارٍ الحفظ..." : "حفظ"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
