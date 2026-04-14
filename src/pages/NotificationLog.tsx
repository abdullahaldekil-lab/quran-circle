import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDateTimeSmart } from "@/lib/hijri";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

interface NotificationRow {
  id: string;
  user_id: string;
  title: string;
  body: string;
  channel: string;
  status: string;
  created_at: string;
  sent_at: string | null;
  read_at: string | null;
  meta_data: Record<string, unknown> | null;
  profiles?: { full_name: string } | null;
}

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "قيد الانتظار", variant: "outline" },
  sent: { label: "مُرسل", variant: "default" },
  read: { label: "مقروء", variant: "secondary" },
  failed: { label: "فشل", variant: "destructive" },
};

const CHANNEL_MAP: Record<string, string> = {
  inApp: "داخلي",
  email: "بريد",
  whatsapp: "واتساب",
};

const CATEGORY_FILTERS = [
  { value: "all", label: "كل الأنواع" },
  { value: "request", label: "طلبات" },
  { value: "task", label: "مهام" },
  { value: "attendance", label: "حضور" },
  { value: "academic", label: "أكاديمي" },
  { value: "system", label: "النظام" },
];

const DATE_FILTERS = [
  { value: "all", label: "كل الأوقات" },
  { value: "today", label: "اليوم" },
  { value: "week", label: "هذا الأسبوع" },
  { value: "month", label: "هذا الشهر" },
];

const getNotifIcon = (n: NotificationRow) => {
  const code = ((n.meta_data?.templateCode as string) || "").toUpperCase();
  const title = n.title || "";
  if (code.includes("REQUEST") || title.includes("طلب")) return "📋";
  if (code.includes("TASK") || title.includes("مهمة")) return "✅";
  if (code.includes("ABSENT") || code.includes("ABSENCE") || title.includes("غياب")) return "⚠️";
  if (code.includes("BADGE") || title.includes("شارة")) return "🏅";
  if (code.includes("NARRATION") || title.includes("سرد")) return "📖";
  if (code.includes("RECITATION") || title.includes("تسميع")) return "🎙️";
  return "🔔";
};

const getNotifCategory = (n: NotificationRow): string => {
  const code = ((n.meta_data?.templateCode as string) || "").toUpperCase();
  const title = n.title || "";
  if (code.includes("REQUEST") || title.includes("طلب")) return "request";
  if (code.includes("TASK") || title.includes("مهمة")) return "task";
  if (code.includes("ABSENT") || code.includes("ABSENCE") || title.includes("غياب") || title.includes("حضور")) return "attendance";
  if (code.includes("NARRATION") || code.includes("RECITATION") || code.includes("QUIZ") || code.includes("EXCELLENCE") || title.includes("سرد") || title.includes("اختبار")) return "academic";
  return "system";
};

const NotificationLog = () => {
  const { isManager } = useRole();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [channelFilter, setChannelFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [readFilter, setReadFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const fetchNotifs = async () => {
      setLoading(true);
      let query = supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (channelFilter !== "all") query = query.eq("channel", channelFilter);
      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      if (readFilter === "unread") query = query.is("read_at", null);
      if (readFilter === "read") query = query.not("read_at", "is", null);

      if (dateFilter !== "all") {
        const now = new Date();
        let from: string;
        if (dateFilter === "today") from = new Date().toISOString().split("T")[0];
        else if (dateFilter === "week") {
          const d = new Date(); d.setDate(d.getDate() - 7); from = d.toISOString().split("T")[0];
        } else {
          const d = new Date(); d.setMonth(d.getMonth() - 1); from = d.toISOString().split("T")[0];
        }
        query = query.gte("created_at", from);
      }

      const { data } = await query;
      const items = (data || []) as any[];
      const userIds = [...new Set(items.map((n) => n.user_id))];
      let profileMap = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
        profileMap = new Map((profiles || []).map((p: any) => [p.id, p.full_name]));
      }
      const enriched = items.map((n) => ({ ...n, profiles: { full_name: profileMap.get(n.user_id) || "—" } }));
      setNotifications(enriched as NotificationRow[]);
      setLoading(false);
    };
    fetchNotifs();
  }, [channelFilter, statusFilter, readFilter, dateFilter]);

  const filtered = notifications.filter((n) => {
    if (categoryFilter !== "all" && getNotifCategory(n) !== categoryFilter) return false;
    if (!search) return true;
    return n.title?.includes(search) || n.body?.includes(search) || n.profiles?.full_name?.includes(search);
  });

  const handleDeleteRead = async () => {
    if (!isManager) return;
    setDeleting(true);
    const { error } = await supabase.from("notifications").delete().not("read_at", "is", null);
    if (error) { toast.error("حدث خطأ أثناء الحذف"); } else {
      toast.success("تم حذف الإشعارات المقروءة");
      setNotifications((prev) => prev.filter((n) => !n.read_at));
    }
    setDeleting(false);
  };

  const handleRowClick = (n: NotificationRow) => {
    const code = ((n.meta_data?.templateCode as string) || "").toUpperCase();
    const requestId = n.meta_data?.request_id as string;
    const taskId = n.meta_data?.task_id as string;
    if (requestId) return navigate("/internal-requests", { state: { openRequestId: requestId } });
    if (taskId) return navigate("/staff-tasks");
    if (code.includes("TASK") || n.title?.includes("مهمة")) return navigate("/staff-tasks");
    if (code.includes("REQUEST") || n.title?.includes("طلب")) return navigate("/internal-requests");
    if (code.includes("ABSENT") || n.title?.includes("غياب")) return navigate("/attendance");
    if (code.includes("NARRATION")) return navigate("/quran-narration");
  };

  if (!isManager) return <div className="p-8 text-center text-muted-foreground">غير مصرح</div>;

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">سجل الإشعارات</h1>
        {isManager && (
          <Button variant="destructive" size="sm" onClick={handleDeleteRead} disabled={deleting}>
            <Trash2 className="w-4 h-4 ml-1" />
            حذف المقروءة
          </Button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <Input placeholder="بحث..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="النوع" /></SelectTrigger>
          <SelectContent>
            {CATEGORY_FILTERS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={channelFilter} onValueChange={setChannelFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="القناة" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل القنوات</SelectItem>
            <SelectItem value="inApp">داخلي</SelectItem>
            <SelectItem value="email">بريد</SelectItem>
            <SelectItem value="whatsapp">واتساب</SelectItem>
          </SelectContent>
        </Select>
        <Select value={readFilter} onValueChange={setReadFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="القراءة" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">الكل</SelectItem>
            <SelectItem value="unread">غير مقروء</SelectItem>
            <SelectItem value="read">مقروء</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="الحالة" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الحالات</SelectItem>
            <SelectItem value="pending">قيد الانتظار</SelectItem>
            <SelectItem value="sent">مُرسل</SelectItem>
            <SelectItem value="read">مقروء</SelectItem>
            <SelectItem value="failed">فشل</SelectItem>
          </SelectContent>
        </Select>
        <Select value={dateFilter} onValueChange={setDateFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="الفترة" /></SelectTrigger>
          <SelectContent>
            {DATE_FILTERS.map((f) => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <p className="text-sm text-muted-foreground">{filtered.length} إشعار</p>

      {loading ? (
        <div className="text-center p-8 text-muted-foreground">جارٍ التحميل...</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10"></TableHead>
              <TableHead>المستخدم</TableHead>
              <TableHead>العنوان</TableHead>
              <TableHead>القناة</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead>وقت الإنشاء</TableHead>
              <TableHead>وقت القراءة</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((n) => {
              const st = STATUS_MAP[n.status] || STATUS_MAP.pending;
              return (
                <TableRow key={n.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleRowClick(n)}>
                  <TableCell className="text-center text-base">{getNotifIcon(n)}</TableCell>
                  <TableCell>{n.profiles?.full_name || "—"}</TableCell>
                  <TableCell>
                    <div>
                      <p className="text-sm font-medium">{n.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{n.body}</p>
                    </div>
                  </TableCell>
                  <TableCell>{CHANNEL_MAP[n.channel] || n.channel}</TableCell>
                  <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                  <TableCell className="text-xs">{formatDateTimeSmart(n.created_at)}</TableCell>
                  <TableCell className="text-xs">{n.read_at ? formatDateTimeSmart(n.read_at) : "—"}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
};

export default NotificationLog;
