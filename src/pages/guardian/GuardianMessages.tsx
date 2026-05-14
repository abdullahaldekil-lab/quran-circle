import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import GuardianLayout from "@/components/GuardianLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { MessageSquare, Send, Plus } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";

const GuardianMessages = () => {
  const navigate = useNavigate();
  const [guardian, setGuardian] = useState<any>(null);
  const [children, setChildren] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [studentId, setStudentId] = useState<string>("");
  const [recipient, setRecipient] = useState("admin");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const load = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate("/guardian-auth"); return; }

    const { data: gp } = await supabase.from("guardian_profiles").select("*").eq("id", session.user.id).maybeSingle();
    if (!gp) { navigate("/guardian-auth"); return; }
    setGuardian(gp);

    const { data: links } = await supabase.from("guardian_students").select("student_id").eq("guardian_id", session.user.id);
    if (links?.length) {
      const ids = links.map(l => l.student_id);
      const { data: kids } = await supabase.from("students").select("id, full_name").in("id", ids);
      setChildren(kids || []);
    }

    const { data: msgs } = await supabase
      .from("guardian_messages" as any)
      .select("*, students(full_name)")
      .eq("guardian_id", session.user.id)
      .order("created_at", { ascending: false });
    setMessages(msgs || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) { toast.error("الرجاء تعبئة الموضوع والمحتوى"); return; }
    setSending(true);
    const { error } = await supabase.from("guardian_messages" as any).insert({
      guardian_id: guardian.id,
      student_id: studentId || null,
      recipient_role: recipient,
      subject: subject.trim(),
      body: body.trim(),
    });
    setSending(false);
    if (error) { toast.error(error.message); return; }
    toast.success("تم إرسال الرسالة");
    setShowForm(false);
    setSubject(""); setBody(""); setStudentId("");
    load();
  };

  const statusBadge = (s: string) => {
    if (s === "replied") return <Badge className="bg-success/15 text-success">تم الرد</Badge>;
    if (s === "closed") return <Badge variant="secondary">مغلقة</Badge>;
    return <Badge className="bg-warning/15 text-warning">قيد المعالجة</Badge>;
  };

  return (
    <GuardianLayout guardianName={guardian?.full_name}>
      <div className="space-y-4 animate-fade-in">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">الرسائل</h1>
          <Button size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus className="w-4 h-4 ml-1" />
            رسالة جديدة
          </Button>
        </div>

        {showForm && (
          <Card>
            <CardHeader><CardTitle className="text-base">رسالة جديدة</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>المستلم</Label>
                <Select value={recipient} onValueChange={setRecipient}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">الإدارة</SelectItem>
                    <SelectItem value="teacher">المعلم</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {children.length > 0 && (
                <div>
                  <Label>الطالب (اختياري)</Label>
                  <Select value={studentId} onValueChange={setStudentId}>
                    <SelectTrigger><SelectValue placeholder="بشأن أي ابن؟" /></SelectTrigger>
                    <SelectContent>
                      {children.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <Label>الموضوع</Label>
                <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="موضوع الرسالة" />
              </div>
              <div>
                <Label>المحتوى</Label>
                <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="اكتب رسالتك..." rows={4} />
              </div>
              <Button onClick={handleSend} disabled={sending} className="w-full">
                <Send className="w-4 h-4 ml-1" />
                {sending ? "جارٍ الإرسال..." : "إرسال"}
              </Button>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <MessageSquare className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">لا توجد رسائل بعد</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {messages.map((m) => (
              <Card key={m.id}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-sm">{m.subject}</h3>
                    {statusBadge(m.status)}
                  </div>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{m.body}</p>
                  {m.students?.full_name && (
                    <p className="text-xs text-muted-foreground mt-1">بشأن: {m.students.full_name}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-2">
                    {formatDistanceToNow(new Date(m.created_at), { addSuffix: true, locale: ar })}
                  </p>
                  {m.reply && (
                    <div className="mt-3 pt-3 border-t bg-primary/5 -mx-4 -mb-4 px-4 pb-3 pt-3 rounded-b-lg">
                      <p className="text-xs font-medium text-primary mb-1">رد الإدارة:</p>
                      <p className="text-sm whitespace-pre-wrap">{m.reply}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </GuardianLayout>
  );
};

export default GuardianMessages;
