import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { formatDateSmart } from "@/lib/hijri";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  ClipboardList, CheckCircle2, XCircle, Clock, AlertCircle,
  ArrowRightLeft, Trash2, MessageCircle, Copy, Users, Pencil, Printer
} from "lucide-react";
import EnrollmentCombinedPrint from "@/components/enrollment/EnrollmentCombinedPrint";
import { Input } from "@/components/ui/input";

type ReqStatus = "pending" | "approved" | "rejected" | "waiting_list";

interface EnrollmentReq {
  id: string;
  guardian_full_name: string;
  guardian_phone: string;
  student_full_name: string;
  student_birth_year: number | null;
  form_data: Record<string, string> | null;
  requested_halaqa_id: string | null;
  preferred_time: string | null;
  notes: string | null;
  status: ReqStatus;
  rejection_reason: string | null;
  assigned_halaqa_id: string | null;
  converted_student_id: string | null;
  created_at: string;
}

interface HalaqaInfo {
  id: string;
  name: string;
  capacity_max: number;
  active_count: number;
}

const STATUS_MAP: Record<ReqStatus, { label: string; color: string; icon: React.ElementType }> = {
  pending: { label: "قيد المراجعة", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  approved: { label: "مقبول", color: "bg-green-100 text-green-800", icon: CheckCircle2 },
  rejected: { label: "مرفوض", color: "bg-red-100 text-red-800", icon: XCircle },
  waiting_list: { label: "قائمة انتظار", color: "bg-orange-100 text-orange-800", icon: AlertCircle },
};

const EnrollmentRequests = () => {
  const { session } = useAuth();
  const { canWrite } = useRole();
  const canManage = canWrite("bulk_import");

  const [requests, setRequests] = useState<EnrollmentReq[]>([]);
  const [halaqat, setHalaqat] = useState<HalaqaInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Approval dialog
  const [selectedReq, setSelectedReq] = useState<EnrollmentReq | null>(null);
  const [showApprove, setShowApprove] = useState(false);
  const [assignHalaqa, setAssignHalaqa] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [approveAction, setApproveAction] = useState<"approve" | "reject" | "waiting_list">("approve");
  const [processing, setProcessing] = useState(false);

  // WhatsApp dialog
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [whatsAppMsg, setWhatsAppMsg] = useState("");
  const [whatsAppPhone, setWhatsAppPhone] = useState("");

  // Print acceptance letter
  const [printReq, setPrintReq] = useState<EnrollmentReq | null>(null);
  const [showPrint, setShowPrint] = useState(false);

  // Edit dialog
  const [editReq, setEditReq] = useState<EnrollmentReq | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editHalaqa, setEditHalaqa] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editStudentName, setEditStudentName] = useState("");
  const [editGuardianName, setEditGuardianName] = useState("");
  const [editGuardianPhone, setEditGuardianPhone] = useState("");
  const [editFormData, setEditFormData] = useState<Record<string, string>>({});

  const fetchData = async () => {
    setLoading(true);
    const [reqRes, halaqatRes] = await Promise.all([
      supabase.from("enrollment_requests").select("*, form_data").order("created_at", { ascending: false }),
      supabase.from("halaqat").select("id, name, capacity_max").eq("active", true),
    ]);

    const halaqatData = halaqatRes.data || [];

    // Get student counts per halaqa
    const halaqatWithCounts: HalaqaInfo[] = [];
    for (const h of halaqatData) {
      const { count } = await supabase.from("students").select("id", { count: "exact", head: true }).eq("halaqa_id", h.id).eq("status", "active");
      halaqatWithCounts.push({ ...h, active_count: count || 0 });
    }

    setRequests((reqRes.data as EnrollmentReq[]) || []);
    setHalaqat(halaqatWithCounts);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const filtered = filterStatus === "all" ? requests : requests.filter((r) => r.status === filterStatus);

  const getHalaqaName = (id: string | null) => {
    if (!id) return "—";
    return halaqat.find((h) => h.id === id)?.name || "—";
  };

  const openApproveDialog = (req: EnrollmentReq, action: "approve" | "reject" | "waiting_list") => {
    setSelectedReq(req);
    setApproveAction(action);
    setAssignHalaqa(req.requested_halaqa_id || "");
    setRejectReason("");

    // Auto-suggest waiting list if requested halaqa is full
    if (action === "approve" && req.requested_halaqa_id) {
      const h = halaqat.find((h) => h.id === req.requested_halaqa_id);
      if (h && h.active_count >= h.capacity_max) {
        setApproveAction("waiting_list");
        setRejectReason("الحلقة مكتملة");
        toast.info("الحلقة المطلوبة مكتملة - تم اقتراح قائمة الانتظار");
      }
    }

    setShowApprove(true);
  };

  const handleApproveAction = async () => {
    if (!selectedReq) return;
    setProcessing(true);

    if (approveAction === "approve") {
      // Validate halaqa capacity
      if (assignHalaqa) {
        const h = halaqat.find((h) => h.id === assignHalaqa);
        if (h && h.active_count >= h.capacity_max) {
          toast.error("الحلقة مكتملة العدد. اختر حلقة أخرى أو ضع في الانتظار.");
          setProcessing(false);
          return;
        }
      }

      // Create student
      const { data: student, error: sErr } = await supabase.from("students").insert({
        full_name: selectedReq.student_full_name,
        halaqa_id: assignHalaqa || null,
        status: "active",
        current_level: "تمهيدي",
        guardian_name: selectedReq.guardian_full_name,
        guardian_phone: selectedReq.guardian_phone,
        notes: selectedReq.notes,
      }).select("id").single();

      if (sErr) { toast.error(sErr.message); setProcessing(false); return; }

      // Update request
      await supabase.from("enrollment_requests").update({
        status: "approved" as ReqStatus,
        assigned_halaqa_id: assignHalaqa || null,
        converted_student_id: student.id,
        reviewed_by: session?.user?.id,
        reviewed_at: new Date().toISOString(),
      }).eq("id", selectedReq.id);

      // Generate WhatsApp message
      const halaqaName = getHalaqaName(assignHalaqa);
      const msg = `السلام عليكم ورحمة الله وبركاته\n\nأبشركم بقبول طلب تسجيل ابنكم "${selectedReq.student_full_name}" في مجمع حويلان لتحفيظ القرآن الكريم.\n${assignHalaqa ? `\nالحلقة: ${halaqaName}` : ""}\n\nنسأل الله التوفيق والسداد.\nمجمع حويلان لتحفيظ القرآن`;
      setWhatsAppPhone(selectedReq.guardian_phone);
      setWhatsAppMsg(msg);

      toast.success(`تم قبول "${selectedReq.student_full_name}" وإنشاء ملف الطالب`);

    } else if (approveAction === "reject") {
      await supabase.from("enrollment_requests").update({
        status: "rejected" as ReqStatus,
        rejection_reason: rejectReason || null,
        reviewed_by: session?.user?.id,
        reviewed_at: new Date().toISOString(),
      }).eq("id", selectedReq.id);

      const msg = `السلام عليكم ورحمة الله وبركاته\n\nنأسف لإبلاغكم بعدم قبول طلب تسجيل "${selectedReq.student_full_name}" حالياً.\n${rejectReason ? `\nالسبب: ${rejectReason}` : ""}\n\nمجمع حويلان لتحفيظ القرآن`;
      setWhatsAppPhone(selectedReq.guardian_phone);
      setWhatsAppMsg(msg);

      toast.success("تم رفض الطلب");

    } else {
      await supabase.from("enrollment_requests").update({
        status: "waiting_list" as ReqStatus,
        rejection_reason: rejectReason || "الحلقة مكتملة",
        reviewed_by: session?.user?.id,
        reviewed_at: new Date().toISOString(),
      }).eq("id", selectedReq.id);

      const msg = `السلام عليكم ورحمة الله وبركاته\n\nتم وضع طلب تسجيل ابنكم "${selectedReq.student_full_name}" في قائمة الانتظار.\n${rejectReason ? `\nالسبب: ${rejectReason}` : ""}\n\nسيتم التواصل معكم فور توفر مقعد إن شاء الله.\nمجمع حويلان لتحفيظ القرآن`;
      setWhatsAppPhone(selectedReq.guardian_phone);
      setWhatsAppMsg(msg);

      toast.success("تم وضع الطلب في قائمة الانتظار");
    }

    setProcessing(false);
    setShowApprove(false);
    setShowWhatsApp(true);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await supabase.from("enrollment_requests").delete().eq("id", id);
    toast.success("تم الحذف");
    fetchData();
  };

  const openEditDialog = (r: EnrollmentReq) => {
    setEditReq(r);
    setEditHalaqa(r.assigned_halaqa_id || r.requested_halaqa_id || "");
    setEditNotes(r.notes || "");
    setEditStudentName(r.student_full_name);
    setEditGuardianName(r.guardian_full_name);
    setEditGuardianPhone(r.guardian_phone);
    setEditFormData({ ...(r.form_data || {}) });
    setEditOpen(true);
  };

  const updateFormField = (key: string, value: string) => {
    setEditFormData((prev) => ({ ...prev, [key]: value }));
  };

  const handleEditSave = async () => {
    if (!editReq) return;
    setProcessing(true);
    const isApproved = editReq.status === "approved";
    const updates: Record<string, unknown> = {
      student_full_name: editStudentName.trim() || editReq.student_full_name,
      guardian_full_name: editGuardianName.trim() || editReq.guardian_full_name,
      guardian_phone: editGuardianPhone.trim() || editReq.guardian_phone,
      notes: editNotes || null,
      form_data: editFormData,
    };
    if (isApproved) {
      updates.assigned_halaqa_id = editHalaqa || null;
    } else {
      updates.requested_halaqa_id = editHalaqa || null;
    }
    const { error } = await supabase.from("enrollment_requests").update(updates).eq("id", editReq.id);
    if (error) { toast.error(error.message); setProcessing(false); return; }

    // If approved & linked to a student, sync student record
    if (isApproved && editReq.converted_student_id) {
      await supabase.from("students").update({
        full_name: updates.student_full_name as string,
        guardian_name: updates.guardian_full_name as string,
        guardian_phone: updates.guardian_phone as string,
        halaqa_id: editHalaqa || null,
        notes: editNotes || null,
      }).eq("id", editReq.converted_student_id);
    }

    toast.success("تم تحديث الطلب");
    setEditOpen(false);
    setEditReq(null);
    setProcessing(false);
    fetchData();
  };

  const copyWhatsApp = () => {
    navigator.clipboard.writeText(whatsAppMsg);
    toast.success("تم نسخ الرسالة");
  };

  const openWhatsApp = () => {
    const phone = whatsAppPhone.replace(/^0/, "966");
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(whatsAppMsg)}`;
    window.open(url, "_blank");
  };

  const stats = {
    total: requests.length,
    pending: requests.filter((r) => r.status === "pending").length,
    approved: requests.filter((r) => r.status === "approved").length,
    rejected: requests.filter((r) => r.status === "rejected").length,
    waiting: requests.filter((r) => r.status === "waiting_list").length,
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">طلبات الالتحاق</h1>
          <p className="text-muted-foreground text-sm">مراجعة وإدارة طلبات التسجيل الواردة عبر رمز QR</p>
        </div>
        <Button variant="outline" onClick={() => {
          const url = `${window.location.origin}/enroll`;
          navigator.clipboard.writeText(url);
          toast.success("تم نسخ رابط التسجيل");
        }}>
          <Copy className="w-4 h-4 ml-2" />نسخ رابط التسجيل
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "الإجمالي", value: stats.total, color: "text-foreground" },
          { label: "قيد المراجعة", value: stats.pending, color: "text-yellow-600" },
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

      {/* Halaqat capacity overview */}
      {halaqat.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="w-4 h-4" />سعة الحلقات
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {halaqat.map((h) => {
                const pct = Math.round((h.active_count / h.capacity_max) * 100);
                const isFull = h.active_count >= h.capacity_max;
                return (
                  <div key={h.id} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{h.name}</span>
                      <Badge className={isFull ? "bg-green-100 text-green-800" : "bg-orange-100 text-orange-800"}>
                        {isFull ? "مكتمل" : "ناقص"}
                      </Badge>
                    </div>
                    <Progress value={pct} className="h-2" />
                    <p className="text-xs text-muted-foreground text-center">{h.active_count} / {h.capacity_max}</p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {[{ v: "all", l: "الكل" }, ...Object.entries(STATUS_MAP).map(([v, { label }]) => ({ v, l: label }))].map((f) => (
          <Button key={f.v} size="sm" variant={filterStatus === f.v ? "default" : "outline"} onClick={() => setFilterStatus(f.v)}>
            {f.l}
            {f.v === "pending" && stats.pending > 0 && (
              <Badge variant="destructive" className="mr-1 text-xs px-1.5">{stats.pending}</Badge>
            )}
          </Button>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <p className="p-8 text-center text-muted-foreground">جارٍ التحميل...</p>
          ) : filtered.length === 0 ? (
            <p className="p-8 text-center text-muted-foreground">لا توجد طلبات</p>
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
                    <TableHead>التاريخ</TableHead>
                    {canManage && <TableHead>إجراءات</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((r) => {
                    const st = STATUS_MAP[r.status];
                    return (
                      <TableRow key={r.id}>
                        <TableCell>
                          <div>
                            <span className="font-medium">{r.student_full_name}</span>
                            {r.student_birth_year && (
                              <span className="text-xs text-muted-foreground block">مواليد {r.student_birth_year}</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{r.guardian_full_name}</TableCell>
                        <TableCell dir="ltr" className="text-right">{r.guardian_phone}</TableCell>
                        <TableCell>{getHalaqaName(r.requested_halaqa_id)}</TableCell>
                        <TableCell>
                          <Badge className={st.color}>{st.label}</Badge>
                          {r.rejection_reason && (
                            <p className="text-xs text-muted-foreground mt-1">{r.rejection_reason}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDateSmart(r.created_at)}
                        </TableCell>
                        {canManage && (
                          <TableCell>
                            <div className="flex gap-1 flex-wrap">
                              {r.status === "pending" && (
                                <>
                                  <Button size="sm" className="h-7 text-xs" onClick={() => openApproveDialog(r, "approve")}>
                                    <CheckCircle2 className="w-3 h-3 ml-1" />قبول
                                  </Button>
                                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openApproveDialog(r, "reject")}>
                                    <XCircle className="w-3 h-3 ml-1" />رفض
                                  </Button>
                                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openApproveDialog(r, "waiting_list")}>
                                    <Clock className="w-3 h-3 ml-1" />انتظار
                                  </Button>
                                </>
                              )}
                              {r.status === "waiting_list" && !r.converted_student_id && (
                                <Button size="sm" className="h-7 text-xs" onClick={() => openApproveDialog(r, "approve")}>
                                  <ArrowRightLeft className="w-3 h-3 ml-1" />قبول الآن
                                </Button>
                              )}
                              {(r.status === "pending" || r.status === "waiting_list") && !r.converted_student_id && (
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditDialog(r)}>
                                  <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                                </Button>
                              )}
                              {r.status === "approved" && (
                                <>
                                  <Button size="icon" variant="ghost" className="h-7 w-7" title="تعديل البيانات قبل الطباعة" onClick={() => openEditDialog(r)}>
                                    <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="h-7 w-7" title="طباعة خطاب القبول" onClick={() => { setPrintReq(r); setShowPrint(true); }}>
                                    <Printer className="w-3.5 h-3.5 text-primary" />
                                  </Button>
                                </>
                              )}
                              {r.converted_student_id && (
                                <Badge variant="secondary" className="text-xs">تم التحويل</Badge>
                              )}
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => {
                                const phone = r.guardian_phone.replace(/^0/, "966");
                                window.open(`https://wa.me/${phone}`, "_blank");
                              }}>
                                <MessageCircle className="w-3.5 h-3.5 text-green-600" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(r.id)}>
                                <Trash2 className="w-3.5 h-3.5 text-destructive" />
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

      {/* Approval Dialog */}
      <Dialog open={showApprove} onOpenChange={setShowApprove}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {approveAction === "approve" ? "قبول الطلب" : approveAction === "reject" ? "رفض الطلب" : "قائمة الانتظار"}
            </DialogTitle>
          </DialogHeader>
          {selectedReq && (
            <div className="space-y-4">
              <div className="border rounded-lg p-3 space-y-1 text-sm">
                <p><strong>الطالب:</strong> {selectedReq.student_full_name}</p>
                <p><strong>ولي الأمر:</strong> {selectedReq.guardian_full_name}</p>
                <p><strong>الهاتف:</strong> {selectedReq.guardian_phone}</p>
                {selectedReq.preferred_time && <p><strong>الوقت المفضل:</strong> {selectedReq.preferred_time}</p>}
                {selectedReq.notes && <p><strong>ملاحظات:</strong> {selectedReq.notes}</p>}
              </div>

              {approveAction === "approve" && (
                <div className="space-y-2">
                  <Label>تعيين الحلقة</Label>
                  <Select value={assignHalaqa} onValueChange={setAssignHalaqa}>
                    <SelectTrigger><SelectValue placeholder="اختر الحلقة" /></SelectTrigger>
                    <SelectContent>
                      {halaqat.map((h) => (
                        <SelectItem key={h.id} value={h.id} disabled={h.active_count >= h.capacity_max}>
                          {h.name} ({h.active_count}/{h.capacity_max})
                          {h.active_count >= h.capacity_max ? " - مكتمل" : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {(approveAction === "reject" || approveAction === "waiting_list") && (
                <div className="space-y-2">
                  <Label>{approveAction === "reject" ? "سبب الرفض" : "السبب"}</Label>
                  <Textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder={approveAction === "reject" ? "أدخل سبب الرفض..." : "مثال: الحلقة مكتملة"}
                    rows={2}
                  />
                </div>
              )}

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowApprove(false)}>إلغاء</Button>
                <Button
                  className="flex-1"
                  onClick={handleApproveAction}
                  disabled={processing}
                  variant={approveAction === "reject" ? "destructive" : "default"}
                >
                  {processing ? "جارٍ المعالجة..." : approveAction === "approve" ? "تأكيد القبول" : approveAction === "reject" ? "تأكيد الرفض" : "وضع في الانتظار"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* WhatsApp Message Dialog */}
      <Dialog open={showWhatsApp} onOpenChange={setShowWhatsApp}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-green-600" />
              رسالة WhatsApp
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="border rounded-lg p-3 bg-muted/50 whitespace-pre-wrap text-sm">
              {whatsAppMsg}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={copyWhatsApp}>
                <Copy className="w-4 h-4 ml-2" />نسخ الرسالة
              </Button>
              <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={openWhatsApp}>
                <MessageCircle className="w-4 h-4 ml-2" />فتح WhatsApp
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Request Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>تعديل بيانات الطلب</DialogTitle>
          </DialogHeader>
          {editReq && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label>اسم الطالب</Label>
                  <Input value={editStudentName} onChange={(e) => setEditStudentName(e.target.value)} />
                </div>
                <div>
                  <Label>{editReq.status === "approved" ? "الحلقة المعيّنة" : "الحلقة المطلوبة"}</Label>
                  <Select value={editHalaqa} onValueChange={setEditHalaqa}>
                    <SelectTrigger><SelectValue placeholder="اختر الحلقة" /></SelectTrigger>
                    <SelectContent>
                      {halaqat.map((h) => (
                        <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>اسم ولي الأمر</Label>
                  <Input value={editGuardianName} onChange={(e) => setEditGuardianName(e.target.value)} />
                </div>
                <div>
                  <Label>رقم الجوال</Label>
                  <Input dir="ltr" value={editGuardianPhone} onChange={(e) => setEditGuardianPhone(e.target.value)} />
                </div>
              </div>

              <div className="border-t pt-3">
                <p className="text-sm font-semibold mb-2 text-muted-foreground">بيانات الاستمارة (تظهر في الطباعة)</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { k: "student_nationality", l: "الجنسية" },
                    { k: "student_id_number", l: "رقم الهوية / الإقامة" },
                    { k: "student_birth_date_hijri", l: "تاريخ الميلاد (هجري)" },
                    { k: "student_birth_date_gregorian", l: "تاريخ الميلاد (ميلادي)" },
                    { k: "student_age", l: "العمر" },
                    { k: "student_grade", l: "الصف الدراسي" },
                    { k: "student_school", l: "المدرسة" },
                    { k: "living_with", l: "يعيش مع" },
                    { k: "parents_status", l: "الحالة الاجتماعية للوالدين" },
                    { k: "guardian_relationship", l: "صلة القرابة" },
                    { k: "guardian_id_number", l: "رقم هوية ولي الأمر" },
                    { k: "guardian_address", l: "عنوان السكن" },
                    { k: "memorization_amount", l: "مقدار الحفظ الحالي" },
                    { k: "previous_place", l: "مكان التسجيل السابق" },
                  ].map((f) => (
                    <div key={f.k}>
                      <Label className="text-xs">{f.l}</Label>
                      <Input
                        value={editFormData[f.k] || ""}
                        onChange={(e) => updateFormField(f.k, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <Label>ملاحظات</Label>
                <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={3} />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setEditOpen(false)}>إلغاء</Button>
                <Button onClick={handleEditSave} disabled={processing} className="flex-1">
                  {processing ? "جارٍ الحفظ..." : "حفظ التعديلات"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* Print Combined Dialog */}
      <Dialog open={showPrint} onOpenChange={setShowPrint}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Printer className="w-5 h-5" />
              طباعة استمارات القبول والتسجيل
            </DialogTitle>
          </DialogHeader>
          {printReq && (
            <EnrollmentCombinedPrint
              studentName={printReq.student_full_name}
              guardianName={printReq.guardian_full_name}
              guardianPhone={printReq.guardian_phone}
              halaqaName={getHalaqaName(printReq.assigned_halaqa_id)}
              approvedAt={printReq.created_at}
              requestId={printReq.id}
              formData={printReq.form_data ?? {}}
              notes={printReq.notes}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EnrollmentRequests;
