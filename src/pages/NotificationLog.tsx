import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

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

const NotificationLog = () => {
  const { isManager } = useRole();
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [channelFilter, setChannelFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      let query = supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (channelFilter !== "all") query = query.eq("channel", channelFilter);
      if (statusFilter !== "all") query = query.eq("status", statusFilter);

      const { data } = await query;

      // Fetch profile names separately
      const items = (data || []) as any[];
      const userIds = [...new Set(items.map((n) => n.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);
      const profileMap = new Map((profiles || []).map((p: any) => [p.id, p.full_name]));
      const enriched = items.map((n) => ({ ...n, profiles: { full_name: profileMap.get(n.user_id) || "—" } }));
      setNotifications((data as NotificationRow[]) || []);
      setLoading(false);
    };
    fetch();
  }, [channelFilter, statusFilter]);

  const filtered = notifications.filter((n) => {
    if (!search) return true;
    return n.title.includes(search) || n.body.includes(search) || n.profiles?.full_name?.includes(search);
  });

  if (!isManager) return <div className="p-8 text-center text-muted-foreground">غير مصرح</div>;

  return (
    <div className="space-y-6" dir="rtl">
      <h1 className="text-2xl font-bold">سجل الإشعارات</h1>

      <div className="flex flex-wrap gap-3">
        <Input placeholder="بحث..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-xs" />
        <Select value={channelFilter} onValueChange={setChannelFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="القناة" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل القنوات</SelectItem>
            <SelectItem value="inApp">داخلي</SelectItem>
            <SelectItem value="email">بريد</SelectItem>
            <SelectItem value="whatsapp">واتساب</SelectItem>
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
      </div>

      {loading ? (
        <div className="text-center p-8 text-muted-foreground">جارٍ التحميل...</div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
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
                <TableRow key={n.id}>
                  <TableCell>{n.profiles?.full_name || "—"}</TableCell>
                  <TableCell>
                    <div>
                      <p className="text-sm font-medium">{n.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-1">{n.body}</p>
                    </div>
                  </TableCell>
                  <TableCell>{CHANNEL_MAP[n.channel] || n.channel}</TableCell>
                  <TableCell><Badge variant={st.variant}>{st.label}</Badge></TableCell>
                  <TableCell className="text-xs">{format(new Date(n.created_at), "yyyy/MM/dd HH:mm")}</TableCell>
                  <TableCell className="text-xs">{n.read_at ? format(new Date(n.read_at), "yyyy/MM/dd HH:mm") : "—"}</TableCell>
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
