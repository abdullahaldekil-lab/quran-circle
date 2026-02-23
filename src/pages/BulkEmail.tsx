import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mail, Users, Search, X, Send, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Profile {
  id: string;
  full_name: string;
  role: string;
}

const roleLabels: Record<string, string> = {
  manager: "مدير",
  supervisor: "مشرف",
  assistant_supervisor: "مساعد مشرف",
  secretary: "سكرتير",
  admin_staff: "موظف إداري",
  teacher: "معلم",
  assistant_teacher: "مساعد معلم",
};

const BulkEmail = () => {
  const { session } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [recipientFilter, setRecipientFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const fetchProfiles = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, role")
        .eq("active", true)
        .order("full_name");
      if (data) setProfiles(data as Profile[]);
    };
    fetchProfiles();
  }, []);

  const filteredProfiles = profiles.filter((p) => {
    const matchesSearch = p.full_name.includes(recipientFilter);
    const matchesRole = roleFilter === "all" || p.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const selectAll = () => setSelectedRecipients(filteredProfiles.map((p) => p.id));
  const deselectAll = () => setSelectedRecipients([]);
  const toggleRecipient = (id: string) => {
    setSelectedRecipients((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    );
  };

  const handleSend = async () => {
    if (selectedRecipients.length === 0) {
      toast.error("يرجى اختيار مستلم واحد على الأقل");
      return;
    }
    if (!subject.trim() || !body.trim()) {
      toast.error("يرجى ملء الموضوع والمحتوى");
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-bulk-email", {
        body: {
          recipientIds: selectedRecipients,
          subject: subject.trim(),
          body: body.trim(),
        },
      });

      if (error) throw error;

      toast.success(`تم إرسال البريد إلى ${data?.sent || selectedRecipients.length} مستخدم`);
      setSelectedRecipients([]);
      setSubject("");
      setBody("");
    } catch (err) {
      console.error(err);
      toast.error("حدث خطأ أثناء الإرسال. تأكد من إعداد خدمة البريد الإلكتروني.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto" dir="rtl">
      <div className="flex items-center gap-3">
        <Mail className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold">إرسال بريد جماعي</h1>
      </div>

      <Alert>
        <AlertCircle className="w-4 h-4" />
        <AlertDescription>
          لتفعيل إرسال البريد الإلكتروني الفعلي، يجب إعداد مفتاح API لخدمة البريد (مثل Resend).
          حالياً يتم تسجيل الرسائل في سجل الإشعارات كقناة "email".
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Email Content */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Mail className="w-4 h-4" />
              محتوى الرسالة
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>موضوع الرسالة</Label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="موضوع البريد الإلكتروني..."
                maxLength={200}
              />
            </div>
            <div>
              <Label>محتوى الرسالة</Label>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="اكتب محتوى الرسالة هنا..."
                rows={8}
                maxLength={5000}
              />
            </div>
          </CardContent>
        </Card>

        {/* Recipients */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="w-4 h-4" />
              المستلمون
              {selectedRecipients.length > 0 && (
                <Badge variant="default">{selectedRecipients.length}</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute right-2 top-2.5 w-4 h-4 text-muted-foreground" />
                <Input
                  value={recipientFilter}
                  onChange={(e) => setRecipientFilter(e.target.value)}
                  placeholder="بحث..."
                  className="pr-8"
                />
              </div>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الأدوار</SelectItem>
                  {Object.entries(roleLabels).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={selectAll}>تحديد الكل</Button>
              <Button variant="outline" size="sm" onClick={deselectAll}>إلغاء الكل</Button>
            </div>

            {selectedRecipients.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {selectedRecipients.slice(0, 5).map((id) => {
                  const p = profiles.find((pr) => pr.id === id);
                  return p ? (
                    <Badge key={id} variant="secondary" className="text-xs gap-1">
                      {p.full_name}
                      <X className="w-3 h-3 cursor-pointer" onClick={() => toggleRecipient(id)} />
                    </Badge>
                  ) : null;
                })}
                {selectedRecipients.length > 5 && (
                  <Badge variant="outline" className="text-xs">+{selectedRecipients.length - 5} آخرين</Badge>
                )}
              </div>
            )}

            <ScrollArea className="h-56 border rounded-lg">
              <div className="p-2 space-y-1">
                {filteredProfiles.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer">
                    <Checkbox
                      checked={selectedRecipients.includes(p.id)}
                      onCheckedChange={() => toggleRecipient(p.id)}
                    />
                    <span className="text-sm flex-1">{p.full_name}</span>
                    <Badge variant="outline" className="text-[10px]">{roleLabels[p.role] || p.role}</Badge>
                  </label>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSend} disabled={sending} size="lg" className="gap-2">
          <Send className="w-4 h-4" />
          {sending ? "جارٍ الإرسال..." : `إرسال البريد (${selectedRecipients.length})`}
        </Button>
      </div>
    </div>
  );
};

export default BulkEmail;
