import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { CheckSquare, X, Clock, AlertCircle, Check } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { useTeacherHalaqat } from "@/hooks/useTeacherHalaqat";
import { useAuth } from "@/hooks/useAuth";

type AttendanceStatus = Database["public"]["Enums"]["attendance_status"];

const Attendance = () => {
  const { user } = useAuth();
  const { filterHalaqat, loading: accessLoading } = useTeacherHalaqat();
  const [halaqat, setHalaqat] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedHalaqa, setSelectedHalaqa] = useState("");
  const [attendance, setAttendance] = useState<Record<string, AttendanceStatus>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (accessLoading) return;
    supabase.from("halaqat").select("*").eq("active", true).then(({ data }) => {
      const filtered = filterHalaqat(data || []);
      setHalaqat(filtered);
      // Auto-select if teacher has only one halaqa
      if (filtered.length === 1 && !selectedHalaqa) {
        setSelectedHalaqa(filtered[0].id);
      }
    });
  }, [accessLoading]);

  useEffect(() => {
    if (selectedHalaqa) {
      supabase
        .from("students")
        .select("*")
        .eq("halaqa_id", selectedHalaqa)
        .eq("status", "active")
        .order("full_name")
        .then(({ data }) => {
          setStudents(data || []);
          const init: Record<string, AttendanceStatus> = {};
          (data || []).forEach((s: any) => { init[s.id] = "present"; });
          setAttendance(init);
        });

      // Load existing attendance for today
      const today = new Date().toISOString().split("T")[0];
      supabase
        .from("attendance")
        .select("student_id, status")
        .eq("halaqa_id", selectedHalaqa)
        .eq("attendance_date", today)
        .then(({ data }) => {
          if (data?.length) {
            const existing: Record<string, AttendanceStatus> = {};
            data.forEach((a: any) => { existing[a.student_id] = a.status; });
            setAttendance((prev) => ({ ...prev, ...existing }));
          }
        });
    }
  }, [selectedHalaqa]);

  const handleSave = async () => {
    setSaving(true);
    const today = new Date().toISOString().split("T")[0];
    const records = Object.entries(attendance).map(([student_id, status]) => ({
      student_id,
      halaqa_id: selectedHalaqa,
      attendance_date: today,
      status,
    }));

    const { error } = await supabase
      .from("attendance")
      .upsert(records, { onConflict: "student_id,attendance_date" });

    setSaving(false);
    if (error) {
      toast.error("حدث خطأ أثناء الحفظ");
      return;
    }
    toast.success("تم حفظ الحضور بنجاح");
  };

  const statusIcons: Record<AttendanceStatus, any> = {
    present: <Check className="w-4 h-4" />,
    absent: <X className="w-4 h-4" />,
    late: <Clock className="w-4 h-4" />,
    excused: <AlertCircle className="w-4 h-4" />,
  };

  const statusLabels: Record<AttendanceStatus, string> = {
    present: "حاضر",
    absent: "غائب",
    late: "متأخر",
    excused: "معذور",
  };

  const statusColors: Record<AttendanceStatus, string> = {
    present: "bg-success/10 text-success border-success/30",
    absent: "bg-destructive/10 text-destructive border-destructive/30",
    late: "bg-warning/10 text-warning border-warning/30",
    excused: "bg-info/10 text-info border-info/30",
  };

  const cycleStatus = (studentId: string) => {
    const order: AttendanceStatus[] = ["present", "absent", "late", "excused"];
    const current = attendance[studentId] || "present";
    const next = order[(order.indexOf(current) + 1) % order.length];
    setAttendance({ ...attendance, [studentId]: next });
  };

  if (accessLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">الحضور والغياب</h1>
        <p className="text-muted-foreground text-sm">
          {new Date().toLocaleDateString("ar-SA", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      <Select value={selectedHalaqa} onValueChange={setSelectedHalaqa}>
        <SelectTrigger><SelectValue placeholder="اختر الحلقة" /></SelectTrigger>
        <SelectContent>
          {halaqat.map((h) => (
            <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {selectedHalaqa && students.length > 0 && (
        <>
          <div className="space-y-2">
            {students.map((student) => {
              const status = attendance[student.id] || "present";
              return (
                <button
                  key={student.id}
                  onClick={() => cycleStatus(student.id)}
                  className={`w-full flex items-center justify-between p-3 rounded-lg border transition-all ${statusColors[status]}`}
                >
                  <span className="font-medium text-sm">{student.full_name}</span>
                  <div className="flex items-center gap-2 text-xs font-medium">
                    {statusIcons[status]}
                    {statusLabels[status]}
                  </div>
                </button>
              );
            })}
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full" size="lg">
            <CheckSquare className="w-4 h-4 ml-2" />
            {saving ? "جارٍ الحفظ..." : "حفظ الحضور"}
          </Button>
        </>
      )}
    </div>
  );
};

export default Attendance;
