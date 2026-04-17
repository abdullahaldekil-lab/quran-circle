import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ClipboardList, Search } from "lucide-react";
import { formatDateTimeSmart, formatDateHijriOnly } from "@/lib/hijri";

interface AuditEntry {
  id: string;
  attendance_id: string;
  student_id: string;
  old_status: string;
  new_status: string;
  edited_by: string;
  edited_at: string;
  attendance_date: string;
  student_name?: string;
  editor_name?: string;
}

const statusLabels: Record<string, string> = {
  present: "حاضر",
  absent: "غائب",
  late: "متأخر",
  excused: "معذور",
};

const statusVariant = (status: string): "default" | "destructive" | "secondary" | "outline" => {
  switch (status) {
    case "present": return "default";
    case "absent": return "destructive";
    case "late": return "secondary";
    case "excused": return "outline";
    default: return "outline";
  }
};

const AttendanceAuditLog = () => {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchAuditLog = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("attendance_audit_log")
        .select("*")
        .order("edited_at", { ascending: false })
        .limit(200);

      if (error || !data) {
        setLoading(false);
        return;
      }

      // Fetch student and editor names
      const studentIds = [...new Set(data.map((d) => d.student_id))];
      const editorIds = [...new Set(data.map((d) => d.edited_by))];

      const [studentsRes, profilesRes] = await Promise.all([
        studentIds.length > 0
          ? supabase.from("students").select("id, full_name").in("id", studentIds)
          : { data: [] },
        editorIds.length > 0
          ? supabase.from("profiles").select("id, full_name").in("id", editorIds)
          : { data: [] },
      ]);

      const studentMap = Object.fromEntries(
        (studentsRes.data || []).map((s) => [s.id, s.full_name])
      );
      const editorMap = Object.fromEntries(
        (profilesRes.data || []).map((p) => [p.id, p.full_name])
      );

      setEntries(
        data.map((d) => ({
          ...d,
          student_name: studentMap[d.student_id] || "غير معروف",
          editor_name: editorMap[d.edited_by] || "غير معروف",
        }))
      );
      setLoading(false);
    };

    fetchAuditLog();
  }, []);

  const filtered = entries.filter(
    (e) =>
      !search ||
      e.student_name?.includes(search) ||
      e.editor_name?.includes(search)
  );

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center gap-3">
        <ClipboardList className="w-7 h-7 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">سجل تدقيق الحضور</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>جميع التعديلات على سجلات الحضور</span>
            <div className="relative w-64">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="بحث بالاسم..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pr-9"
              />
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center text-muted-foreground py-8">جارٍ التحميل...</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">لا توجد تعديلات مسجّلة</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right w-[18%]">الطالب</TableHead>
                  <TableHead className="text-right w-[14%]">تاريخ الحضور</TableHead>
                  <TableHead className="text-center w-[14%]">الحالة السابقة</TableHead>
                  <TableHead className="text-center w-[14%]">الحالة الجديدة</TableHead>
                  <TableHead className="text-right w-[16%]">عُدّل بواسطة</TableHead>
                  <TableHead className="text-right w-[24%]">وقت التعديل</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium text-right">{entry.student_name}</TableCell>
                    <TableCell className="text-right">{formatDateHijriOnly(entry.attendance_date)}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={statusVariant(entry.old_status)}>
                        {statusLabels[entry.old_status] || entry.old_status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={statusVariant(entry.new_status)}>
                        {statusLabels[entry.new_status] || entry.new_status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{entry.editor_name}</TableCell>
                    <TableCell className="text-muted-foreground text-xs text-right">
                      {formatDateTimeSmart(entry.edited_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AttendanceAuditLog;
