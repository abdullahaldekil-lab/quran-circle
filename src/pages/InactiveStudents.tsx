import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { UserX, RefreshCw, Archive, Search } from "lucide-react";

const STATUS_LABELS: Record<string, string> = {
  inactive: "غير نشط",
  suspended: "موقوف",
  graduated: "خريج",
};

const InactiveStudents = () => {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const { data: students = [], isLoading } = useQuery({
    queryKey: ["inactive-students"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select("id, full_name, status, halaqa_id, guardian_name, guardian_phone, created_at")
        .in("status", ["inactive", "suspended", "graduated"])
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("students").update({ status } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, { status }) => {
      queryClient.invalidateQueries({ queryKey: ["inactive-students"] });
      toast({ title: status === "active" ? "تم إعادة التفعيل" : "تم التحديث" });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const filtered = students.filter((s: any) => {
    if (filterStatus !== "all" && s.status !== filterStatus) return false;
    if (search && !s.full_name.includes(search)) return false;
    return true;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <UserX className="w-6 h-6" />
          الطلاب غير النشطين
        </h1>
        <p className="text-muted-foreground text-sm">{filtered.length} طالب</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="بحث بالاسم..." value={search} onChange={(e) => setSearch(e.target.value)} className="pr-9" />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع الحالات</SelectItem>
            <SelectItem value="inactive">غير نشط</SelectItem>
            <SelectItem value="suspended">موقوف</SelectItem>
            <SelectItem value="graduated">خريج</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">لا يوجد طلاب بهذه الحالة</CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>الاسم</TableHead>
                  <TableHead>الحالة</TableHead>
                  <TableHead>ولي الأمر</TableHead>
                  <TableHead>الهاتف</TableHead>
                  <TableHead className="w-48">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.full_name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{STATUS_LABELS[s.status] || s.status}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{s.guardian_name || "—"}</TableCell>
                    <TableCell className="text-muted-foreground" dir="ltr">{s.guardian_phone || "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => updateStatusMutation.mutate({ id: s.id, status: "active" })} disabled={updateStatusMutation.isPending}>
                          <RefreshCw className="w-3 h-3 ml-1" />إعادة تفعيل
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default InactiveStudents;
