import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface Notification {
  id: string;
  title: string;
  body: string;
  channel: string;
  status: string;
  created_at: string;
  read_at: string | null;
  meta_data: Record<string, unknown>;
}

export const useNotifications = () => {
  const { session } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    if (!session?.user?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", session.user.id)
      .eq("channel", "inApp")
      .order("created_at", { ascending: false })
      .limit(50);

    const items = (data || []) as Notification[];
    setNotifications(items);
    setUnreadCount(items.filter((n) => !n.read_at).length);
    setLoading(false);
  }, [session?.user?.id]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Realtime subscription
  useEffect(() => {
    if (!session?.user?.id) return;

    const channel = supabase
      .channel("notifications-realtime-" + session.user.id)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${session.user.id}`,
        },
        (payload) => {
          const newNotif = payload.new as Notification;
          if (newNotif.channel === "inApp") {
            setNotifications((prev) => [newNotif, ...prev].slice(0, 50));
            setUnreadCount((prev) => prev + 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id]);

  const markAsRead = async (id: string) => {
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString(), status: "read" })
      .eq("id", id);
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, read_at: new Date().toISOString(), status: "read" } : n
      )
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
  };

  const markAllAsRead = async () => {
    if (!session?.user?.id) return;
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString(), status: "read" })
      .eq("user_id", session.user.id)
      .eq("channel", "inApp")
      .is("read_at", null);
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, read_at: new Date().toISOString(), status: "read" }))
    );
    setUnreadCount(0);
  };

  return { notifications, unreadCount, loading, markAsRead, markAllAsRead, refetch: fetchNotifications };
};
