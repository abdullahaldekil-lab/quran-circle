import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import {
  UserPlus, Upload, FileText, Users, CheckCircle2, XCircle,
  Clock, AlertCircle, Eye, Trash2, ArrowRightLeft
} from "lucide-react";

type PreRegStatus = "new" | "under_review" | "approved" | "rejected" | "waiting_list";

interface PreReg {
  id: string;
  student_full_name: string;
  guardian_full_name: string;
  guardian_phone: string | null;
  requested_halaqa: string | null;
  student_notes: string | null;
  relationship: string | null;
  status: PreRegStatus;
  converted_student_id: string | null;
  created_at: string;
}

const STATUS_MAP: Record<PreRegStatus, { label: string; color: string; icon: React.ElementType }> = {
  new: { label: "جديد", color: "bg-blue-100 text-blue-800", icon: Clock },
  under_review: { label: "قيد المراجعة", color: "bg-yellow-100 text-yellow-800", icon: Eye },
  approved: { label: "مقبول", color: "bg-green-100 text-green-800", icon: CheckCircle2 },
  rejected: { label: "مرفوض", color: "bg-red-100 text-red-800", icon: XCircle },
  waiting_list: { label: "قائمة انتظار", color: "bg-orange-100 text-orange-800", icon: AlertCircle },
};

const PreRegistration = () => {
  const { session } = useAuth();
  const { canWrite } = useRole();
  const canManage = canWrite("bulk_import");

  const [records, setRecords] = useState<PreReg[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showAdd, setShowAdd] = useState(false);
  const [showCsv, setShowCsv] = useState(false);
  const [saving, setSaving] = useState(false);
  const [halaqat, setHalaqat] = useState<{ id: string; name: string }[]>([]);

  // Single add form
  const [form, setForm] = useState({
    student_full_name: "",
    guardian_full_name: "",
    guardian_phone: "",
    requested_halaqa: "",
    student_notes: "",
    relationship: "أب",
  });

  // CSV
  const fileRef = useRef<HTMLInputElement>(null);
  const [csvRows, setCsvRows] = useState<any[]>([]);
  const [csvStep, setCsvStep] = useState<"upload" | "preview">("upload");

  const fetchRecords = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("pre_registrations")
      .select("*")
      .order("created_at", { ascending: false });
    setRecords((data as PreReg[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchRecords();
    supabase.from("halaqat").select("id, name").eq("active", true).then(({ data }) => {
      setHalaqat(data || []);
    });
  }, []);

  const filtered = filterStatus === "all" ? records : records.filter((r) => r.status === filterStatus);

  const handleAddSingle = async () => {
    if (!form.student_full_name.trim() || !form.guardian_full_name.trim()) {
      toast.error("اسم الطالب وولي الأمر مطلوبان");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("pre_registrations").insert({
      student_full_name: form.student_full_name.trim(),
      guardian_full_name: form.guardian_full_name.trim(),
      guardian_phone: form.guardian_phone.trim() || null,
      requested_halaqa: form.requested_halaqa.trim() || null,
      student_notes: form.student_notes.trim() || null,
      relationship: form.relationship || "أب",
      created_by: session?.user?.id,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("تم إضافة التسجيل المسبق");
    setForm({ student_full_name: "", guardian_full_name: "", guardian_phone: "", requested_halaqa: "", student_notes: "", relationship: "أب" });
    setShowAdd(false);
    fetchRecords();
  };

  const handleStatusChange = async (id: string, newStatus: PreRegStatus) => {
    const { error } = await supabase.from("pre_registrations").update({
      status: newStatus,
      reviewed_by: session?.user?.id,
      reviewed_at: new Date().toISOString(),
    }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("تم تحديث الحالة");
    fetchRecords();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("pre_registrations").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("تم الحذف");
    fetchRecords();
  };

  const handleConvert = async (rec: PreReg) => {
    if (rec.converted_student_id) { toast.info("تم تحويل هذا السجل مسبقاً"); return; }

    // Find halaqa if requested
    let halaqaId: string | null = null;
    if (rec.requested_halaqa) {
      const match = halaqat.find((h) => h.name === rec.requested_halaqa);
      if (match) halaqaId = match.id;
    }

    // Check capacity if halaqa assigned
    if (halaqaId) {
      const { count } = await supabase.from("students").select("id", { count: "exact", head: true }).eq("halaqa_id", halaqaId).eq("status", "active");
      const { data: halaqaData } = await supabase.from("halaqat").select("capacity_max").eq("id", halaqaId).single();
      if (count !== null && halaqaData && count >= halaqaData.capacity_max) {
        toast.error("الحلقة المطلوبة مكتملة العدد");
        return;
      }
    }

    const { data: student, error: sErr } = await supabase.from("students").insert({
      full_name: rec.student_full_name,
      halaqa_id: halaqaId,
      status: "active",
      current_level: "تمهيدي",
      guardian_name: rec.guardian_full_name,
      guardian_phone: rec.guardian_phone,
      notes: rec.student_notes,
    }).select("id").single();

    if (sErr) { toast.error(sErr.message); return; }

    await supabase.from("pre_registrations").update({
      status: "approved" as PreRegStatus,
      converted_student_id: student.id,
      reviewed_by: session?.user?.id,
      reviewed_at: new Date().toISOString(),
    }).eq("id", rec.id);

    toast.success(`تم تحويل "${rec.student_full_name}" إلى طالب رسمي`);
    fetchRecords();
  };

  // CSV handling
  const handleCsvFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.name.endsWith(".csv")) { toast.error("يرجى اختيار ملف CSV"); return; }
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) { toast.error("الملف فارغ"); return; }

    const header = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/"/g, ""));
    const nameIdx = header.findIndex((h) => ["student_full_name", "student_name", "اسم_الطالب"].includes(h));
    const guardianIdx = header.findIndex((h) => ["guardian_full_name", "guardian_name", "ولي_الأمر"].includes(h));
    const phoneIdx = header.findIndex((h) => ["guardian_phone", "phone", "الهاتف"].includes(h));
    const halaqaIdx = header.findIndex((h) => ["requested_halaqa", "halaqa", "الحلقة"].includes(h));
    const notesIdx = header.findIndex((h) => ["student_notes", "notes", "ملاحظات"].includes(h));
    const relIdx = header.findIndex((h) => ["relationship", "العلاقة"].includes(h));

    if (nameIdx === -1 || guardianIdx === -1) {
      toast.error("الأعمدة المطلوبة: student_full_name و guardian_full_name");
      return;
    }

    const rows: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map((c) => c.trim().replace(/"/g, ""));
      const sName = cols[nameIdx] || "";
      const gName = cols[guardianIdx] || "";
      if (!sName || !gName) continue;
      rows.push({
        student_full_name: sName,
        guardian_full_name: gName,
        guardian_phone: phoneIdx !== -1 ? cols[phoneIdx] || "" : "",
        requested_halaqa: halaqaIdx !== -1 ? cols[halaqaIdx] || "" : "",
        student_notes: notesIdx !== -1 ? cols[notesIdx] || "" : "",
        relationship: relIdx !== -1 ? cols[relIdx] || "أب" : "أب",
      });
    }

    if (rows.length === 0) { toast.error("لا توجد بيانات صالحة"); return; }
    setCsvRows(rows);
    setCsvStep("preview");
  };

  const handleCsvImport = async () => {
    setSaving(true);
    const insertData = csvRows.map((r) => ({
      ...r,
      guardian_phone: r.guardian_phone || null,
      requested_halaqa: r.requested_halaqa || null,
      student_notes: r.student_notes || null,
      created_by: session?.user?.id,
    }));
    const { error } = await supabase.from("pre_registrations").insert(insertData);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(`تم استيراد ${csvRows.length} سجل بنجاح`);
    setCsvRows([]);
    setCsvStep("upload");
    setShowCsv(false);
    if (fileRef.current) fileRef.current.value = "";
    fetchRecords();
  };

  const stats = {
    total: records.length,
    new: records.filter((r) => r.status === "new").length,
    approved: records.filter((r) => r.status === "approved").length,
    rejected: records.filter((r) => r.status === "rejected").length,
    waiting: records.filter((r) => r.status === "waiting_list").length,
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">التسجيل المسبق</h1>
          <p className="text-muted-foreground text-sm">استيراد بيانات الطلاب وأولياء الأمور قبل التفعيل</p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowCsv(true)}>
              <Upload className="w-4 h-4 ml-2" />استيراد CSV
            </Button>
            <Button onClick={() => setShowAdd(true)}>
              <UserPlus className="w-4 h-4 ml-2" />إضافة سجل
            </Button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "الإجمالي", value: stats.total, color: "text-foreground" },
          { label: "جديد", value: stats.new, color: "text-blue-600" },
          { label: "مقبول", value: stats.approved, color: "text-green-600" },
          { label: "مرفوض", value: stats.rejected, color: "text-red-600" },
          { label: "انتظار", value: stats.waiting, color: "text-orange-600" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4 text-center">
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {[{ v: "all", l: "الكل" }, ...Object.entries(STATUS_MAP).map(([v, { label }]) => ({ v, l: label }))].map((f) => (
          <Button
            key={f.v}
            size="sm"
            variant={filterStatus === f.v ? "default" : "outline"}
            onClick={() => setFilterStatus(f.v)}
          >
            {f.l}
          </Button>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-8 text-center text-muted-foreground">جارٍ التحميل...</p>
          ) : filtered.length === 0 ? (
            <p className="p-8 text-center text-muted-foreground">لا توجد سجلات</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الطالب</TableHead>
                    <TableHead>ولي الأمر</TableHead>
                    <TableHead>الهاتف</TableHead>
                    <TableHead>الحلقة المطلوبة</TableHead>
                    <TableHead>الحالة</TableHead>
                    {canManage && <TableHead>إجراءات</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => {
                    const st = STATUS_MAP[r.status];
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.student_full_name}</TableCell>
                        <TableCell>{r.guardian_full_name}</TableCell>
                        <TableCell dir="ltr" className="text-right">{r.guardian_phone || "—"}</TableCell>
                        <TableCell>{r.requested_halaqa || "—"}</TableCell>
                        <TableCell>
                          <Badge className={st.color}>{st.label}</Badge>
                        </TableCell>
                        {canManage && (
                          <TableCell>
                            <div className="flex gap-1 flex-wrap">
                              {r.status !== "approved" && !r.converted_student_id && (
                                <Select onValueChange={(v) => handleStatusChange(r.id, v as PreRegStatus)}>
                                  <SelectTrigger className="w-28 h-8 text-xs">
                                    <SelectValue placeholder="تغيير" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Object.entries(STATUS_MAP).filter(([k]) => k !== r.status).map(([k, v]) => (
                                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}
                              {!r.converted_student_id && r.status !== "rejected" && (
                                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => handleConvert(r)}>
                                  <ArrowRightLeft className="w-3 h-3 ml-1" />تحويل
                                </Button>
                              )}
                              {r.converted_student_id && (
                                <Badge variant="secondary" className="text-xs">تم التحويل</Badge>
                              )}
                              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleDelete(r.id)}>
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add single dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>إضافة تسجيل مسبق</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>اسم الطالب *</Label>
              <Input value={form.student_full_name} onChange={(e) => setForm({ ...form, student_full_name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>اسم ولي الأمر *</Label>
              <Input value={form.guardian_full_name} onChange={(e) => setForm({ ...form, guardian_full_name: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>هاتف ولي الأمر</Label>
              <Input value={form.guardian_phone} onChange={(e) => setForm({ ...form, guardian_phone: e.target.value })} dir="ltr" className="text-right" />
            </div>
            <div className="space-y-1">
              <Label>الحلقة المطلوبة</Label>
              <Input value={form.requested_halaqa} onChange={(e) => setForm({ ...form, requested_halaqa: e.target.value })} />
            </div>
            <div className="space-y-1">
              <Label>العلاقة</Label>
              <Select value={form.relationship} onValueChange={(v) => setForm({ ...form, relationship: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["أب", "أم", "أخ", "عم", "خال", "جد", "أخرى"].map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>ملاحظات</Label>
              <Textarea value={form.student_notes} onChange={(e) => setForm({ ...form, student_notes: e.target.value })} rows={2} />
            </div>
            <Button onClick={handleAddSingle} disabled={saving} className="w-full">
              {saving ? "جارٍ الحفظ..." : "حفظ"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* CSV dialog */}
      <Dialog open={showCsv} onOpenChange={(o) => { if (!o) { setCsvRows([]); setCsvStep("upload"); } setShowCsv(o); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5" />استيراد CSV للتسجيل المسبق
            </DialogTitle>
          </DialogHeader>

          {csvStep === "upload" && (
            <div className="space-y-4">
              <div className="border-2 border-dashed rounded-lg p-8 text-center space-y-3">
                <FileText className="w-10 h-10 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">اختر ملف CSV يحتوي على الأعمدة:</p>
                <code className="text-xs bg-muted px-2 py-1 rounded block">student_full_name, guardian_full_name, guardian_phone</code>
                <input ref={fileRef} type="file" accept=".csv" onChange={handleCsvFile} className="hidden" />
                <Button onClick={() => fileRef.current?.click()} variant="outline">
                  <Upload className="w-4 h-4 ml-2" />اختر ملف
                </Button>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>• الأعمدة المطلوبة: <strong>student_full_name</strong> و <strong>guardian_full_name</strong></p>
                <p>• أعمدة اختيارية: guardian_phone, requested_halaqa, student_notes, relationship</p>
                <p>• الحالة الافتراضية: جديد</p>
              </div>
            </div>
          )}

          {csvStep === "preview" && (
            <div className="space-y-4">
              <Badge variant="secondary">{csvRows.length} سجل</Badge>
              <div className="border rounded-lg max-h-60 overflow-y-auto divide-y text-sm">
                {csvRows.map((r, i) => (
                  <div key={i} className="px-3 py-2 flex items-center justify-between">
                    <div>
                      <span className="font-medium">{r.student_full_name}</span>
                      <span className="text-muted-foreground text-xs mr-2">({r.guardian_full_name})</span>
                    </div>
                    <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => { setCsvRows([]); setCsvStep("upload"); }}>
                  إعادة
                </Button>
                <Button className="flex-1" onClick={handleCsvImport} disabled={saving}>
                  {saving ? "جارٍ الاستيراد..." : `استيراد ${csvRows.length} سجل`}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PreRegistration;
