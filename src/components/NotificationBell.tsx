import { useState } from "react";
import { Bell, Check, CheckCheck } from "lucide-react";
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

const NotificationBell = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [open, setOpen] = useState(false);

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
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={markAllAsRead}>
              <CheckCheck className="w-3 h-3 ml-1" />
              قراءة الكل
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground text-sm">
              لا توجد إشعارات
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-3 cursor-pointer hover:bg-muted/50 transition-colors ${
                    !n.read_at ? "bg-primary/5" : ""
                  }`}
                  onClick={() => {
                    if (!n.read_at) markAsRead(n.id);
                  }}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${!n.read_at ? "font-semibold" : ""}`}>
                        {n.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {n.body}
                      </p>
                      <p className="text-[10px] text-muted-foreground/70 mt-1">
                        {formatDistanceToNow(new Date(n.created_at), {
                          addSuffix: true,
                          locale: ar,
                        })}
                      </p>
                    </div>
                    {!n.read_at && (
                      <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                    )}
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
