import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  studentName: string;
  onDeleted?: () => void;
}

const DeleteStudentPermanentlyDialog = ({ open, onOpenChange, studentId, studentName, onDeleted }: Props) => {
  const [confirmText, setConfirmText] = useState("");
  const [running, setRunning] = useState(false);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  const run = async () => {
    if (confirmText.trim() !== studentName.trim()) {
      toast.error("اكتب اسم الطالب كما هو للتأكيد");
      return;
    }
    setRunning(true);
    setErrorDetail(null);
    try {
      const { error } = await supabase.rpc("delete_student_permanently" as any, {
        _student_id: studentId,
      });
      if (error) throw error;
      toast.success("تم حذف الطالب وجميع سجلاته نهائيًا");
      onOpenChange(false);
      setConfirmText("");
      onDeleted?.();
    } catch (e: any) {
      setErrorDetail(
        [
          e.message && `الرسالة: ${e.message}`,
          e.code && `الرمز: ${e.code}`,
          e.details && `التفاصيل: ${e.details}`,
          e.hint && `الاقتراح: ${e.hint}`,
        ]
          .filter(Boolean)
          .join("\n")
      );
      toast.error("فشل الحذف النهائي — راجع التفاصيل");
    } finally {
      setRunning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !running && onOpenChange(o)}>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-destructive" />
            حذف الطالب نهائيًا
          </DialogTitle>
          <DialogDescription>
            سيتم حذف الطالب «{studentName}» وكل سجلاته (الحضور، التسميع، الاختبارات، الخطط، البرامج...) بلا إمكانية استرجاع.
          </DialogDescription>
        </DialogHeader>

        <Alert variant="destructive">
          <AlertTriangle className="w-4 h-4" />
          <AlertTitle>تحذير: عملية نهائية</AlertTitle>
          <AlertDescription>لا يمكن استرجاع البيانات بعد الحذف. يُنصح بالأرشفة أولًا.</AlertDescription>
        </Alert>

        <div className="space-y-2">
          <Label>اكتب اسم الطالب للتأكيد</Label>
          <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder={studentName} />
        </div>

        {errorDetail && (
          <Alert variant="destructive">
            <AlertTriangle className="w-4 h-4" />
            <AlertTitle>تفاصيل الخطأ</AlertTitle>
            <AlertDescription>
              <pre className="whitespace-pre-wrap text-xs">{errorDetail}</pre>
            </AlertDescription>
          </Alert>
        )}

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={running}>
            إلغاء
          </Button>
          <Button
            variant="destructive"
            className="flex-1"
            onClick={run}
            disabled={running || confirmText.trim() !== studentName.trim()}
          >
            {running && <Loader2 className="w-4 h-4 ml-1 animate-spin" />}
            حذف نهائي
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DeleteStudentPermanentlyDialog;
