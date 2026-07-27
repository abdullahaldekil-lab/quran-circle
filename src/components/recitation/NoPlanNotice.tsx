import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CalendarPlus } from "lucide-react";

interface Props {
  studentId: string;
  studentName?: string;
  /** Shown when the notice blocks recitation entry. */
  blocking?: boolean;
}

/** Warns that a student has no active memorization plan and links to create one. */
const NoPlanNotice = ({ studentId, studentName, blocking = false }: Props) => {
  const navigate = useNavigate();

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/student-annual-plan/${studentId}`)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          navigate(`/student-annual-plan/${studentId}`);
        }
      }}
      className="cursor-pointer border-amber-300 bg-amber-50 transition-colors hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/30 dark:hover:bg-amber-950/50"
    >
      <CardContent className="flex items-start justify-between gap-3 p-4">
        <div className="space-y-1">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            الطالب غير مربوط بخطة حفظ
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-400">
            {studentName ? `${studentName}: ` : ""}
            {blocking
              ? "لا يمكن تسجيل التسميع قبل اعتماد منهج الحفظ. اضغط هنا لإضافة الخطة."
              : "اضغط هنا لإضافة منهج الحفظ من بداية العام أو من تاريخ انضمامه."}
          </p>
        </div>
        <Button size="sm" className="shrink-0" onClick={(e) => { e.stopPropagation(); navigate(`/student-annual-plan/${studentId}`); }}>
          <CalendarPlus className="ml-1 h-4 w-4" />
          إضافة الخطة
        </Button>
      </CardContent>
    </Card>
  );
};

export default NoPlanNotice;
