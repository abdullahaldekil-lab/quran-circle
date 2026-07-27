import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, CalendarPlus, GraduationCap } from "lucide-react";

interface Props {
  studentId: string;
  studentName?: string;
  /** Shown when the notice blocks recitation entry. */
  blocking?: boolean;
}

/** Warns that a student has no memorization track (or annual plan) and links to set one. */
const NoPlanNotice = ({ studentId, studentName, blocking = false }: Props) => {
  const navigate = useNavigate();
  const goTrack = () => navigate(`/students/${studentId}`);

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={goTrack}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          goTrack();
        }
      }}
      className="cursor-pointer border-amber-300 bg-amber-50 transition-colors hover:bg-amber-100 dark:border-amber-800 dark:bg-amber-950/30 dark:hover:bg-amber-950/50"
    >
      <CardContent className="flex flex-wrap items-start justify-between gap-3 p-4">
        <div className="space-y-1">
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            الطالب غير مربوط بمسار حفظ
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-400">
            {studentName ? `${studentName}: ` : ""}
            {blocking
              ? "لا يمكن تسجيل التسميع قبل تحديد مسار الحفظ الذي يُتابع ويُسمَّع يومياً."
              : "حدد مسار الحفظ الخاص بالطالب ليتم اعتماده في التسميع اليومي."}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button size="sm" onClick={(e) => { e.stopPropagation(); goTrack(); }}>
            <GraduationCap className="ml-1 h-4 w-4" />
            تحديد مسار الحفظ
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => { e.stopPropagation(); navigate(`/student-annual-plan/${studentId}`); }}
          >
            <CalendarPlus className="ml-1 h-4 w-4" />
            خطة سنوية
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default NoPlanNotice;
