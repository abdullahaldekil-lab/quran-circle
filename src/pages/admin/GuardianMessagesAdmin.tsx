import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

const GuardianMessagesAdmin = () => {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState("open");

  const load = async () => {
    setLoading(true);
    const { data: msgs } = await supabase
      .from("guardian_messages" as any).select("*, students(full_name)")
      .order("created_at", { ascending: false });
    if (msgs?.length) {
      const ids = Array.from(new Set(msgs.map((m: any) => m.guardian_id)));
      const { data: gps } = await supabase.from("guardian_profiles").select("id, full_name, phone").in("id", ids);
      const gpMap = new Map((gps || []).map((g: any) => [g.id, g]));
      msgs.forEach((m: any) => { m.guardian = gpMap.get(m.guardian_id); });
    }
    setMessages(msgs || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleReply = async (id: string) => {
    const reply = replyText[id]?.trim();
    if (!reply) { toast.error("الرجاء كتابة الرد"); return; }
    const { data: { session } } = await supabase.auth.getSession();
    const { error } = await supabase.from("guardian_messages" as any).update({
      reply, replied_by: session?.user.id, replied_at: new Date().toISOString(), status: "replied",
    }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("تم إرسال الرد");
    setReplyText(p => ({ ...p, [id]: "" }));
    load();
  };

  const close = async (id: string) => {
    await supabase.from("guardian_messages" as any).update({ status: "closed" }).eq("id", id);
    load();
  };

  const filtered = messages.filter(m => filter === "all" || m.status === filter);

  return (
    <div className="space-y-4" dir="rtl">
      <h1 className="text-2xl font-bold">رسائل أولياء الأمور</h1>

      <Tabs value={filter} onValueChange={setFilter}>
        <TabsList>
          <TabsTrigger value="open">قيد المعالجة</TabsTrigger>
          <TabsTrigger value="replied">تم الرد</TabsTrigger>
          <TabsTrigger value="closed">مغلقة</TabsTrigger>
          <TabsTrigger value="all">الكل</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <p className="text-muted-foreground text-center py-10">جارٍ التحميل...</p>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-8 text-center">
          <MessageSquare className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">لا توجد رسائل</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((m: any) => (
            <Card key={m.id}>
              <CardContent className="p-4 space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold">{m.subject}</h3>
                    <p className="text-xs text-muted-foreground">
                      من: {m.guardian?.full_name} {m.guardian?.phone && <span dir="ltr">({m.guardian.phone})</span>}
                      {m.students?.full_name && <> — بشأن: {m.students.full_name}</>}
                    </p>
                  </div>
                  <Badge variant={m.status === "replied" ? "default" : m.status === "closed" ? "secondary" : "outline"}>
                    {m.status === "replied" ? "تم الرد" : m.status === "closed" ? "مغلقة" : "قيد المعالجة"}
                  </Badge>
                </div>
                <p className="text-sm whitespace-pre-wrap bg-muted/50 p-3 rounded">{m.body}</p>
                <p className="text-[10px] text-muted-foreground">
                  {formatDistanceToNow(new Date(m.created_at), { addSuffix: true, locale: ar })}
                </p>

                {m.reply ? (
                  <div className="bg-primary/5 p-3 rounded">
                    <p className="text-xs font-medium text-primary mb-1">الرد:</p>
                    <p className="text-sm whitespace-pre-wrap">{m.reply}</p>
                  </div>
                ) : (
                  <div className="space-y-2 pt-2 border-t">
                    <Textarea
                      placeholder="اكتب الرد..." rows={3}
                      value={replyText[m.id] || ""}
                      onChange={(e) => setReplyText(p => ({ ...p, [m.id]: e.target.value }))}
                    />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => handleReply(m.id)}>إرسال الرد</Button>
                      {m.status !== "closed" && (
                        <Button size="sm" variant="outline" onClick={() => close(m.id)}>إغلاق دون رد</Button>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default GuardianMessagesAdmin;
