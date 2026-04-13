import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { sendNotification } from "@/utils/sendNotification";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Plus, Inbox, Send, BarChart3, Clock, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

type RequestType = "إجازة" | "مستلزمات" | "صيانة" | "استفسار" | "أمر عمل" | "أخرى";
type RequestPriority = "عاجل" | "عادي" | "منخفض";
type RequestStatus = "new" | "in_progress" | "done" | "rejected";

const STATUS_MAP: Record<RequestStatus, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  new: { label: "جديد", variant: "default" },
  in_progress: { label: "قيد التنفيذ", variant: "secondary" },
  done: { label: "مكتمل", variant: "outline" },
  rejected: { label: "مرفوض", variant: "destructive" },
};

const PRIORITY_COLORS: Record<RequestPriority, string> = {
  "عاجل": "text-destructive font-bold",
  "عادي": "text-foreground",
  "منخفض": "text-muted-foreground",
};

const InternalRequests = () => {
  const { user } = useAuth();
  const { isManager, isSupervisor, role } = useRole();
  const location = useLocation();
  const canViewAll = isManager || isSupervisor;
  const defaultTab = (location.state as any)?.defaultTab || (canViewAll ? "admin" : "inbox");

  const [inbox, setInbox] = useState<any[]>([]);
  const [sent, setSent] = useState<any[]>([]);
  const [allRequests, setAllRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [replies, setReplies] = useState<any[]>([]);
  const [replyText, setReplyText] = useState("");
  const [saving, setSaving] = useState(false);
  const [staff, setStaff] = useState<any[]>([]);

  // Filters for admin tab
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterSender, setFilterSender] = useState<string>("all");

  // New request form
  const [form, setForm] = useState({
    title: "",
    body: "",
    request_type: "أخرى" as RequestType,
    priority: "عادي" as RequestPriority,
    to_user_id: "",
    to_role: "",
    due_date: "",
  });

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);

    // Fetch inbox (received) — managers see all requests
    let inboxQuery = supabase
      .from("internal_requests")
      .select("*, from_user:profiles!internal_requests_from_user_id_fkey(full_name)")
      .order("created_at", { ascending: false });

    if (!canViewAll) {
      inboxQuery = inboxQuery
        .or(`to_user_id.eq.${user.id},to_role.eq.${role}`)
        .neq("from_user_id", user.id);
    }

    const { data: inboxData } = await inboxQuery;
    setInbox(inboxData || []);

    // Fetch sent
    const { data: sentData } = await supabase
      .from("internal_requests")
      .select("*, to_user:profiles!internal_requests_to_user_id_fkey(full_name)")
      .eq("from_user_id", user.id)
      .order("created_at", { ascending: false });
    setSent(sentData || []);

    // Fetch all (admin)
    if (canViewAll) {
      const { data: allData } = await supabase
        .from("internal_requests")
        .select("*, from_user:profiles!internal_requests_from_user_id_fkey(full_name), to_user:profiles!internal_requests_to_user_id_fkey(full_name)")
        .order("created_at", { ascending: false });
      setAllRequests(allData || []);
    }

    // Fetch staff for new request
    const { data: staffData } = await supabase.from("profiles").select("id, full_name, role").order("full_name");
    setStaff(staffData || []);

    setLoading(false);
  };

  const fetchReplies = async (requestId: string) => {
    const { data } = await supabase
      .from("internal_request_replies")
      .select("*, from_user:profiles!internal_request_replies_from_user_id_fkey(full_name)")
      .eq("request_id", requestId)
      .order("created_at");
    setReplies(data || []);
  };

  useEffect(() => {
    fetchData();

    const channel = supabase
      .channel('internal-requests-realtime')
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'internal_requests'
      }, () => fetchData())
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'internal_request_replies'
      }, (payload: any) => {
        if (selectedRequest?.id === payload.new.request_id) {
          fetchReplies(selectedRequest.id);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, selectedRequest?.id]);

  // Open specific request from notification navigation
  useEffect(() => {
    const openRequestId = (location.state as any)?.openRequestId;
    if (openRequestId && !loading) {
      const allItems = [...inbox, ...sent, ...allRequests];
      const target = allItems.find((r: any) => r.id === openRequestId);
      if (target) {
        openDetail(target);
        // Clear state to prevent reopening
        window.history.replaceState({}, document.title);
      }
    }
  }, [location.state, loading, inbox, sent, allRequests]);

  const openDetail = async (req: any) => {
    setSelectedRequest(req);
    setDetailDialogOpen(true);
    setReplyText("");
    fetchReplies(req.id);
  };

  const handleStatusChange = async (status: RequestStatus) => {
    if (!selectedRequest) return;
    const { error } = await supabase
      .from("internal_requests")
      .update({ status })
      .eq("id", selectedRequest.id);
    if (error) { toast.error("خطأ في تحديث الحالة"); return; }
    toast.success("تم تحديث الحالة");
    setSelectedRequest({ ...selectedRequest, status });

    // Notify the request creator about status change
    if (selectedRequest.from_user_id && selectedRequest.from_user_id !== user?.id) {
      const statusLabel = status === "done" ? "مكتمل" : status === "rejected" ? "مرفوض" : "قيد التنفيذ";
      sendNotification({
        templateCode: "REQUEST_STATUS",
        recipientIds: [selectedRequest.from_user_id],
        variables: { title: selectedRequest.title, status: statusLabel },
        metaData: { request_id: selectedRequest.id, templateCode: "REQUEST_STATUS" },
      });
    }

    fetchData();
  };

  const handleReply = async () => {
    if (!replyText.trim() || !selectedRequest || !user) return;
    setSaving(true);
    const { error } = await supabase.from("internal_request_replies").insert({
      request_id: selectedRequest.id,
      from_user_id: user.id,
      body: replyText.trim(),
    });
    if (error) { toast.error("خطأ في إرسال الرد"); setSaving(false); return; }
    toast.success("تم إرسال الرد");
    setReplyText("");

    // Notify original requester about the reply
    if (selectedRequest.from_user_id && selectedRequest.from_user_id !== user.id) {
      const currentUserName = staff.find(s => s.id === user.id)?.full_name || "موظف";
      sendNotification({
        templateCode: "REQUEST_REPLY",
        recipientIds: [selectedRequest.from_user_id],
        variables: { senderName: currentUserName, title: selectedRequest.title },
        metaData: { request_id: selectedRequest.id, templateCode: "REQUEST_REPLY" },
      });
    }

    const { data } = await supabase
      .from("internal_request_replies")
      .select("*, from_user:profiles!internal_request_replies_from_user_id_fkey(full_name)")
      .eq("request_id", selectedRequest.id)
      .order("created_at");
    setReplies(data || []);
    setSaving(false);
  };

  const handleNewRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const payload: any = {
      title: form.title,
      body: form.body,
      request_type: form.request_type,
      priority: form.priority,
      from_user_id: user.id,
      due_date: form.due_date || null,
    };
    if (form.to_user_id && form.to_user_id !== "none") payload.to_user_id = form.to_user_id;
    if (form.to_role && form.to_role !== "none") payload.to_role = form.to_role;

    const { data: newReqData, error } = await supabase.from("internal_requests").insert(payload).select("id").single();
    if (error) { toast.error("خطأ في إرسال الطلب"); setSaving(false); return; }

    // Send notification via unified sendNotification
    const senderName = staff.find(s => s.id === user.id)?.full_name || "موظف";
    const recipientIds = payload.to_user_id
      ? [payload.to_user_id]
      : staff.filter(s => s.role === payload.to_role && s.id !== user.id).map(s => s.id);

    if (recipientIds.length > 0) {
      sendNotification({
        templateCode: "NEW_REQUEST",
        recipientIds,
        variables: { requestType: form.request_type, senderName, title: form.title },
        metaData: { request_id: newReqData?.id, templateCode: "NEW_REQUEST" },
      });
    }

    toast.success("تم إرسال الطلب بنجاح");
    setNewDialogOpen(false);
    setForm({ title: "", body: "", request_type: "أخرى", priority: "عادي", to_user_id: "", to_role: "", due_date: "" });
    setSaving(false);
    fetchData();
  };

  const filteredAll = allRequests.filter((r) => {
    if (filterType !== "all" && r.request_type !== filterType) return false;
    if (filterStatus !== "all" && r.status !== filterStatus) return false;
    if (filterSender !== "all" && r.from_user_id !== filterSender) return false;
    return true;
  });

  const pendingCount = allRequests.filter((r) => r.status === "new").length;
  const doneCount = allRequests.filter((r) => r.status === "done").length;
  const urgentCount = allRequests.filter((r) => r.priority === "عاجل" && r.status !== "done").length;

  const renderRequestRow = (req: any, showSender = true) => {
    const st = STATUS_MAP[req.status as RequestStatus] || STATUS_MAP.new;
    return (
      <TableRow key={req.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openDetail(req)}>
        {showSender && <TableCell className="font-medium">{req.from_user?.full_name || "—"}</TableCell>}
        <TableCell>{req.request_type}</TableCell>
        <TableCell><span className={PRIORITY_COLORS[req.priority as RequestPriority] || ""}>{req.priority}</span></TableCell>
        <TableCell>{req.title}</TableCell>
        <TableCell className="text-xs text-muted-foreground">{new Date(req.created_at).toLocaleDateString("ar-SA")}</TableCell>
        <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
      </TableRow>
    );
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">الطلبات الداخلية</h1>
          <p className="text-sm text-muted-foreground">إرسال واستقبال الطلبات والأوامر بين الموظفين</p>
        </div>
        <Button onClick={() => setNewDialogOpen(true)}>
          <Plus className="w-4 h-4 ml-1" />
          طلب جديد
        </Button>
      </div>

      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList>
          {canViewAll ? (
            <>
              <TabsTrigger value="admin" className="gap-1">📋 جميع الطلبات ({allRequests.length})</TabsTrigger>
              <TabsTrigger value="inbox" className="gap-1">📥 الواردة لي ({inbox.length})</TabsTrigger>
              <TabsTrigger value="sent" className="gap-1">📤 الصادرة ({sent.length})</TabsTrigger>
            </>
          ) : (
            <>
              <TabsTrigger value="inbox" className="gap-1"><Inbox className="w-4 h-4" /> الوارد ({inbox.length})</TabsTrigger>
              <TabsTrigger value="sent" className="gap-1"><Send className="w-4 h-4" /> الصادر ({sent.length})</TabsTrigger>
            </>
          )}
        </TabsList>

        {/* Inbox Tab */}
        <TabsContent value="inbox">
          <Card>
            <CardContent className="p-0">
              {inbox.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">لا توجد طلبات واردة</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>المرسل</TableHead>
                      <TableHead>النوع</TableHead>
                      <TableHead>الأولوية</TableHead>
                      <TableHead>العنوان</TableHead>
                      <TableHead>التاريخ</TableHead>
                      <TableHead>الحالة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>{inbox.map((r) => renderRequestRow(r, true))}</TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Sent Tab */}
        <TabsContent value="sent">
          <Card>
            <CardContent className="p-0">
              {sent.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">لم ترسل أي طلبات بعد</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>المستقبل</TableHead>
                      <TableHead>النوع</TableHead>
                      <TableHead>الأولوية</TableHead>
                      <TableHead>العنوان</TableHead>
                      <TableHead>التاريخ</TableHead>
                      <TableHead>الحالة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sent.map((r) => {
                      const st = STATUS_MAP[r.status as RequestStatus] || STATUS_MAP.new;
                      return (
                        <TableRow key={r.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openDetail(r)}>
                          <TableCell className="font-medium">{r.to_user?.full_name || r.to_role || "—"}</TableCell>
                          <TableCell>{r.request_type}</TableCell>
                          <TableCell><span className={PRIORITY_COLORS[r.priority as RequestPriority] || ""}>{r.priority}</span></TableCell>
                          <TableCell>{r.title}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString("ar-SA")}</TableCell>
                          <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Admin Tab */}
        {canViewAll && (
          <TabsContent value="admin">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Clock className="w-5 h-5 text-primary" />
                  </div>
                  <div><p className="text-2xl font-bold">{pendingCount}</p><p className="text-xs text-muted-foreground">طلبات معلقة</p></div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                  </div>
                  <div><p className="text-2xl font-bold">{doneCount}</p><p className="text-xs text-muted-foreground">مكتملة</p></div>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-destructive" />
                  </div>
                  <div><p className="text-2xl font-bold">{urgentCount}</p><p className="text-xs text-muted-foreground">عاجلة</p></div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="w-40"><SelectValue placeholder="النوع" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">جميع الأنواع</SelectItem>
                      <SelectItem value="إجازة">إجازة</SelectItem>
                      <SelectItem value="مستلزمات">مستلزمات</SelectItem>
                      <SelectItem value="صيانة">صيانة</SelectItem>
                      <SelectItem value="استفسار">استفسار إداري</SelectItem>
                      <SelectItem value="أمر عمل">أمر عمل</SelectItem>
                      <SelectItem value="أخرى">أخرى</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-40"><SelectValue placeholder="الحالة" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">جميع الحالات</SelectItem>
                      <SelectItem value="new">جديد</SelectItem>
                      <SelectItem value="in_progress">قيد التنفيذ</SelectItem>
                      <SelectItem value="done">مكتمل</SelectItem>
                      <SelectItem value="rejected">مرفوض</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filterSender} onValueChange={setFilterSender}>
                    <SelectTrigger className="w-48"><SelectValue placeholder="المُرسِل" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">جميع المرسلين</SelectItem>
                      {staff.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-sm text-muted-foreground mr-auto">{filteredAll.length} طلب</span>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>المرسل</TableHead>
                      <TableHead>النوع</TableHead>
                      <TableHead>الأولوية</TableHead>
                      <TableHead>العنوان</TableHead>
                      <TableHead>التاريخ</TableHead>
                      <TableHead>الحالة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>{filteredAll.map((r) => renderRequestRow(r, true))}</TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {selectedRequest && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedRequest.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline">{selectedRequest.request_type}</Badge>
                  <span className={PRIORITY_COLORS[selectedRequest.priority as RequestPriority] || ""}>{selectedRequest.priority}</span>
                  <Badge variant={STATUS_MAP[selectedRequest.status as RequestStatus]?.variant || "default"}>
                    {STATUS_MAP[selectedRequest.status as RequestStatus]?.label}
                  </Badge>
                </div>
                {selectedRequest.body && <p className="text-sm bg-muted p-3 rounded-md">{selectedRequest.body}</p>}
                {selectedRequest.due_date && (
                  <p className="text-xs text-muted-foreground">تاريخ الاستحقاق: {new Date(selectedRequest.due_date).toLocaleDateString("ar-SA")}</p>
                )}

                {/* Status actions (for receiver/manager) */}
                {(selectedRequest.to_user_id === user?.id || selectedRequest.to_role === role || canViewAll) && selectedRequest.from_user_id !== user?.id && (
                  <div className="flex gap-2 flex-wrap">
                    {selectedRequest.status !== "in_progress" && (
                      <Button size="sm" variant="secondary" onClick={() => handleStatusChange("in_progress")}>
                        <Clock className="w-3.5 h-3.5 ml-1" /> قيد التنفيذ
                      </Button>
                    )}
                    {selectedRequest.status !== "done" && (
                      <Button size="sm" variant="outline" onClick={() => handleStatusChange("done")}>
                        <CheckCircle className="w-3.5 h-3.5 ml-1" /> تم التنفيذ
                      </Button>
                    )}
                    {selectedRequest.status !== "rejected" && (
                      <Button size="sm" variant="destructive" onClick={() => handleStatusChange("rejected")}>
                        <XCircle className="w-3.5 h-3.5 ml-1" /> رفض
                      </Button>
                    )}
                  </div>
                )}

                <Separator />

                {/* Replies */}
                <div className="space-y-2">
                  <p className="text-sm font-semibold">الردود ({replies.length})</p>
                  {replies.map((r) => (
                    <div key={r.id} className="bg-muted/50 p-2 rounded-md text-sm">
                      <p className="font-medium text-xs text-primary">{r.from_user?.full_name}</p>
                      <p>{r.body}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{new Date(r.created_at).toLocaleString("ar-SA")}</p>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="اكتب رداً..."
                    className="min-h-[60px]"
                  />
                </div>
                <Button onClick={handleReply} disabled={saving || !replyText.trim()} className="w-full">
                  {saving ? "جارٍ الإرسال..." : "إرسال الرد"}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* New Request Dialog */}
      <Dialog open={newDialogOpen} onOpenChange={setNewDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>طلب جديد</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleNewRequest} className="space-y-4">
            <div className="space-y-2">
              <Label>العنوان</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label>التفاصيل</Label>
              <Textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>النوع</Label>
                <Select value={form.request_type} onValueChange={(v) => setForm({ ...form, request_type: v as RequestType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="إجازة">إجازة</SelectItem>
                    <SelectItem value="مستلزمات">مستلزمات</SelectItem>
                    <SelectItem value="صيانة">صيانة</SelectItem>
                    <SelectItem value="استفسار">استفسار إداري</SelectItem>
                    <SelectItem value="أمر عمل">أمر عمل</SelectItem>
                    <SelectItem value="أخرى">أخرى</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>الأولوية</Label>
                <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v as RequestPriority })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="عاجل">عاجل</SelectItem>
                    <SelectItem value="عادي">عادي</SelectItem>
                    <SelectItem value="منخفض">منخفض</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>إرسال إلى (شخص محدد)</Label>
              <Select value={form.to_user_id} onValueChange={(v) => setForm({ ...form, to_user_id: v, to_role: "" })}>
                <SelectTrigger><SelectValue placeholder="اختر موظفاً" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— بدون —</SelectItem>
                  {staff.filter((s) => s.id !== user?.id).map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>أو إرسال لدور</Label>
              <Select value={form.to_role} onValueChange={(v) => setForm({ ...form, to_role: v, to_user_id: "" })}>
                <SelectTrigger><SelectValue placeholder="اختر دوراً" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— بدون —</SelectItem>
                  <SelectItem value="manager">المدير</SelectItem>
                  <SelectItem value="supervisor">المشرف</SelectItem>
                  <SelectItem value="secretary">السكرتير</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>تاريخ الاستحقاق (اختياري)</Label>
              <Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            </div>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? "جارٍ الإرسال..." : "إرسال الطلب"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InternalRequests;
