import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/hooks/useNotifications";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

const getNotifIcon = (n: { meta_data?: Record<string, unknown>; title?: string }) => {
  const code = (n.meta_data?.templateCode as string) || "";
  const title = n.title || "";
  if (code.includes("REQUEST") || title.includes("طلب")) return "📋";
  if (code.includes("TASK") || title.includes("مهمة")) return "✅";
  if (code.includes("ABSENT") || code.includes("ABSENCE") || title.includes("غياب")) return "⚠️";
  if (code.includes("BADGE") || title.includes("شارة")) return "🏅";
  if (code.includes("NARRATION") || title.includes("سرد")) return "📖";
  if (code.includes("RECITATION") || title.includes("تسميع")) return "🎙️";
  return "🔔";
};

const NotificationBell = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const navigate = useNavigate();

  const displayed = showUnreadOnly ? notifications.filter((n) => !n.read_at) : notifications;

  const handleNotifClick = (n: (typeof notifications)[0]) => {
    if (!n.read_at) markAsRead(n.id);
    setOpen(false);
    const code = (n.meta_data?.templateCode as string) || "";
    const requestId = n.meta_data?.request_id as string;
    const taskId = n.meta_data?.task_id as string;

    if (requestId) return navigate("/internal-requests", { state: { openRequestId: requestId } });
    if (taskId) return navigate("/staff-tasks");
    if (code.includes("ABSENT") || code.includes("ABSENCE") || code.includes("LATE")) return navigate("/attendance");
    if (code.includes("RECITATION")) return navigate("/recitation");
    if (code.includes("TASK")) return navigate("/staff-tasks");
    if (code.includes("NARRATION")) return navigate("/quran-narration");
    if (code.includes("BADGE") || code.includes("REWARD")) return navigate("/rewards");
    // Fallback: check title
    if (n.title?.includes("طلب")) return navigate("/internal-requests");
    if (n.title?.includes("مهمة")) return navigate("/staff-tasks");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end" side="bottom">
        <div className="flex items-center justify-between p-3 border-b">
          <h4 className="font-semibold text-sm">الإشعارات</h4>
          <div className="flex gap-1">
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setShowUnreadOnly(!showUnreadOnly)}>
              {showUnreadOnly ? "عرض الكل" : "غير المقروءة"}
            </Button>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={markAllAsRead}>
                <CheckCheck className="w-3 h-3 ml-1" />
                قراءة الكل
              </Button>
            )}
          </div>
        </div>
        <ScrollArea className="max-h-80">
          {displayed.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-sm">
              {showUnreadOnly ? "لا توجد إشعارات غير مقروءة" : "لا توجد إشعارات"}
            </div>
          ) : (
            <div className="divide-y">
              {displayed.map((n) => (
                <div
                  key={n.id}
                  className={`p-3 cursor-pointer hover:bg-muted/50 transition-colors ${!n.read_at ? "bg-primary/5" : ""}`}
                  onClick={() => handleNotifClick(n)}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-base mt-0.5">{getNotifIcon(n)}</span>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!n.read_at ? "font-semibold" : ""}`}>{n.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                      <p className="text-[10px] text-muted-foreground/70 mt-1">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ar })}
                      </p>
                    </div>
                    {!n.read_at && <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationBell;
