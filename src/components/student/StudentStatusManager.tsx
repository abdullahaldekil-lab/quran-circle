import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { AlertTriangle, ArrowRightLeft, UserX, FileText, Shield, Undo2 } from "lucide-react";
import { formatDateHijriOnly } from "@/lib/hijri";

interface Props {
  student: any;
  isManager: boolean;
  onStatusChanged: () => void;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  active: { label: "نشط", color: "bg-success/10 text-success border-success/20" },
  inactive: { label: "غير نشط", color: "bg-muted text-muted-foreground" },
  "inactive_transferred": { label: "غير نشط – منتقل", color: "bg-info/10 text-info border-info/20" },
  "inactive_excluded": { label: "غير نشط – مستبعد", color: "bg-destructive/10 text-destructive border-destructive/20" },
  "inactive_absence": { label: "غير نشط – مستبعد بسبب الغياب", color: "bg-destructive/10 text-destructive border-destructive/20" },
  "inactive_other": { label: "غير نشط – أخرى", color: "bg-muted text-muted-foreground" },
  warned: { label: "منذَر – قيد الفصل", color: "bg-warning/10 text-warning border-warning/20" },
  suspended: { label: "موقوف", color: "bg-destructive/10 text-destructive border-destructive/20" },
};

const getStatusInfo = (status: string) => STATUS_MAP[status] || STATUS_MAP.inactive;

type ActionType = "transfer" | "exclude" | "other" | "manual" | "reactivate" | null;

const StudentStatusManager = ({ student, isManager, onStatusChanged }: Props) => {
  const { profile } = useAuth();
  const [action, setAction] = useState<ActionType>(null);
  const [transferDest, setTransferDest] = useState("");
  const [transferDate, setTransferDate] = useState("");
  const [excludeReason, setExcludeReason] = useState("");
  const [otherReason, setOtherReason] = useState("");
  const [manualStatus, setManualStatus] = useState("");
  const [manualNote, setManualNote] = useState("");
  const [loading, setLoading] = useState(false);

  const logAndUpdate = async (newStatus: string, reasonCategory: string, reasonDetail?: string, transferDest?: string) => {
    setLoading(true);
    try {
      const updateData: any = {
        status: newStatus,
        inactivation_reason: reasonDetail || null,
        inactivation_date: new Date().toISOString().split("T")[0],
      };
      if (transferDest) updateData.transfer_destination = transferDest;
      if (newStatus === "active") {
        updateData.inactivation_reason = null;
        updateData.inactivation_date = null;
        updateData.warning_level = 0;
        updateData.transfer_destination = null;
      }

      const { error: updateErr } = await supabase
        .from("students")
        .update(updateData as any)
        .eq("id", student.id);
      if (updateErr) throw updateErr;

      const { error: logErr } = await supabase
        .from("student_status_log" as any)
        .insert({
          student_id: student.id,
          old_status: student.status,
          new_status: newStatus,
          reason_category: reasonCategory,
          reason_detail: reasonDetail || null,
          transfer_destination: transferDest || null,
          changed_by: profile?.id || null,
          changed_by_name: profile?.full_name || "مدير",
          is_system: false,
        });
      if (logErr) console.error("Log error:", logErr);

      toast.success("تم تحديث حالة الطالب بنجاح");
      setAction(null);
      onStatusChanged();
    } catch (e: any) {
      toast.error("حدث خطأ: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTransfer = () => {
    if (!transferDest.trim()) { toast.error("أدخل اسم المجمع الجديد"); return; }
    logAndUpdate("inactive_transferred", "transfer", `انتقال إلى: ${transferDest}${transferDate ? ` بتاريخ ${formatDateHijriOnly(transferDate)}` : ""}`, transferDest);
  };

  const handleExclude = () => {
    if (!excludeReason.trim()) { toast.error("أدخل سبب الاستبعاد"); return; }
    logAndUpdate("inactive_excluded", "exclusion", excludeReason);
  };

  const handleOther = () => {
    if (!otherReason.trim()) { toast.error("أدخل السبب"); return; }
    logAndUpdate("inactive_other", "other", otherReason);
  };

  const handleManual = () => {
    if (!manualStatus) { toast.error("اختر الحالة"); return; }
    logAndUpdate(manualStatus, "manual", manualNote || "تعديل يدوي من المدير");
  };

  const handleReactivate = () => {
    logAndUpdate("active", "reactivation", manualNote || "إعادة تفعيل من المدير");
  };

  const statusInfo = getStatusInfo(student.status);

  return (
    <div className="space-y-3">
      {/* Current Status Badge */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-muted-foreground">الحالة:</span>
        <Badge variant="outline" className={statusInfo.color}>
          {statusInfo.label}
        </Badge>
        {(student.warning_level > 0 && student.status === "active") && (
          <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20">
            <AlertTriangle className="w-3 h-3 ml-1" />
            إنذار {student.warning_level}
          </Badge>
        )}
      </div>

      {/* Manager Actions */}
      {isManager && (
        <div className="flex flex-wrap gap-2">
          {student.status === "active" && (
            <>
              <Button variant="outline" size="sm" onClick={() => setAction("transfer")}>
                <ArrowRightLeft className="w-3.5 h-3.5 ml-1" />
                تحويل لمجمع آخر
              </Button>
              <Button variant="outline" size="sm" className="text-destructive" onClick={() => setAction("exclude")}>
                <UserX className="w-3.5 h-3.5 ml-1" />
                استبعاد
              </Button>
              <Button variant="outline" size="sm" onClick={() => setAction("other")}>
                <FileText className="w-3.5 h-3.5 ml-1" />
                أسباب أخرى
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={() => setAction("manual")}>
            <Shield className="w-3.5 h-3.5 ml-1" />
            تعديل الحالة
          </Button>
          {student.status !== "active" && (
            <Button variant="outline" size="sm" className="text-success" onClick={() => { setManualNote(""); setAction("reactivate"); }}>
              <Undo2 className="w-3.5 h-3.5 ml-1" />
              إعادة تفعيل
            </Button>
          )}
        </div>
      )}

      {/* Transfer Dialog */}
      <Dialog open={action === "transfer"} onOpenChange={(o) => !o && setAction(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>تحويل لمجمع آخر</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>اسم المجمع الجديد *</Label>
              <Input value={transferDest} onChange={(e) => setTransferDest(e.target.value)} placeholder="مثال: مجمع النور" />
            </div>
            <div className="space-y-2">
              <Label>تاريخ الانتقال</Label>
              <Input type="date" value={transferDate} onChange={(e) => setTransferDate(e.target.value)} dir="ltr" />
            </div>
            <Button onClick={handleTransfer} disabled={loading} className="w-full">تأكيد التحويل</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Exclude Dialog */}
      <Dialog open={action === "exclude"} onOpenChange={(o) => !o && setAction(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>استبعاد الطالب</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>سبب الاستبعاد *</Label>
              <Textarea value={excludeReason} onChange={(e) => setExcludeReason(e.target.value)} placeholder="أدخل سبب الاستبعاد..." />
            </div>
            <Button onClick={handleExclude} disabled={loading} variant="destructive" className="w-full">تأكيد الاستبعاد</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Other Reason Dialog */}
      <Dialog open={action === "other"} onOpenChange={(o) => !o && setAction(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>تحويل لغير نشط – أسباب أخرى</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>السبب *</Label>
              <Textarea value={otherReason} onChange={(e) => setOtherReason(e.target.value)} placeholder="أدخل السبب..." />
            </div>
            <Button onClick={handleOther} disabled={loading} className="w-full">تأكيد</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manual Status Change Dialog */}
      <Dialog open={action === "manual"} onOpenChange={(o) => !o && setAction(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>تعديل حالة الطالب يدوياً</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>الحالة الجديدة *</Label>
              <Select value={manualStatus} onValueChange={setManualStatus}>
                <SelectTrigger><SelectValue placeholder="اختر الحالة" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">نشط</SelectItem>
                  <SelectItem value="inactive">غير نشط</SelectItem>
                  <SelectItem value="warned">منذَر – قيد الفصل</SelectItem>
                  <SelectItem value="suspended">موقوف</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>ملاحظة</Label>
              <Textarea value={manualNote} onChange={(e) => setManualNote(e.target.value)} placeholder="سبب التغيير..." />
            </div>
            <Button onClick={handleManual} disabled={loading} className="w-full">حفظ</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Reactivate Dialog */}
      <Dialog open={action === "reactivate"} onOpenChange={(o) => !o && setAction(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>إعادة تفعيل الطالب</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">سيتم إعادة الطالب "{student.full_name}" إلى حالة "نشط" وإلغاء جميع الإنذارات.</p>
            <div className="space-y-2">
              <Label>ملاحظة (اختياري)</Label>
              <Textarea value={manualNote} onChange={(e) => setManualNote(e.target.value)} placeholder="سبب إعادة التفعيل..." />
            </div>
            <Button onClick={handleReactivate} disabled={loading} className="w-full bg-success hover:bg-success/90 text-success-foreground">تأكيد إعادة التفعيل</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StudentStatusManager;
