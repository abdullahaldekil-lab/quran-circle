import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { sendNotification } from "@/utils/sendNotification";
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
import { Send, Users, Bell, Search, X } from "lucide-react";

interface Profile {
  id: string;
  full_name: string;
  role: string;
}

interface Template {
  id: string;
  code: string;
  title: string;
  body: string;
  category: string;
  default_channels: string[];
  is_active: boolean;
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

const SendNotification = () => {
  const { session } = useAuth();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [customTitle, setCustomTitle] = useState("");
  const [customBody, setCustomBody] = useState("");
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [recipientFilter, setRecipientFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [sending, setSending] = useState(false);
  const [mode, setMode] = useState<"template" | "custom">("template");

  useEffect(() => {
    const fetchData = async () => {
      const [tplRes, profilesRes] = await Promise.all([
        supabase.from("notification_templates").select("*").eq("is_active", true).order("title"),
        supabase.from("profiles").select("id, full_name, role").eq("active", true).order("full_name"),
      ]);
      if (tplRes.data) setTemplates(tplRes.data as Template[]);
      if (profilesRes.data) setProfiles(profilesRes.data as Profile[]);
    };
    fetchData();
  }, []);

  const filteredProfiles = profiles.filter((p) => {
    const matchesSearch = p.full_name.includes(recipientFilter);
    const matchesRole = roleFilter === "all" || p.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const selectAll = () => {
    setSelectedRecipients(filteredProfiles.map((p) => p.id));
  };

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

    if (mode === "template" && !selectedTemplate) {
      toast.error("يرجى اختيار قالب");
      return;
    }

    if (mode === "custom" && (!customTitle.trim() || !customBody.trim())) {
      toast.error("يرجى ملء العنوان والمحتوى");
      return;
    }

    setSending(true);
    try {
      if (mode === "template") {
        const tpl = templates.find((t) => t.code === selectedTemplate);
        if (!tpl) return;
        await sendNotification({
          templateCode: tpl.code,
          recipientIds: selectedRecipients,
          variables: {},
        });
      } else {
        // For custom notifications, insert directly
        const notifications = selectedRecipients.map((userId) => ({
          user_id: userId,
          title: customTitle.trim(),
          body: customBody.trim(),
          channel: "inApp",
          status: "sent",
          meta_data: { source: "manual", sent_by: session?.user?.id },
        }));

        const { error } = await supabase.from("notifications").insert(notifications);
        if (error) throw error;
      }

      toast.success(`تم إرسال الإشعار إلى ${selectedRecipients.length} مستخدم`);
      setSelectedRecipients([]);
      setCustomTitle("");
      setCustomBody("");
    } catch (err) {
      console.error(err);
      toast.error("حدث خطأ أثناء الإرسال");
    } finally {
      setSending(false);
    }
  };

  const selectedTpl = templates.find((t) => t.code === selectedTemplate);

  return (
    <div className="space-y-6 max-w-4xl mx-auto" dir="rtl">
      <div className="flex items-center gap-3">
        <Send className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold">إرسال إشعار</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Notification Content */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Bell className="w-4 h-4" />
              محتوى الإشعار
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Button
                variant={mode === "template" ? "default" : "outline"}
                size="sm"
                onClick={() => setMode("template")}
              >
                من قالب
              </Button>
              <Button
                variant={mode === "custom" ? "default" : "outline"}
                size="sm"
                onClick={() => setMode("custom")}
              >
                مخصص
              </Button>
            </div>

            {mode === "template" ? (
              <div className="space-y-3">
                <div>
                  <Label>اختر القالب</Label>
                  <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر قالب الإشعار..." />
                    </SelectTrigger>
                    <SelectContent>
                      {templates.map((t) => (
                        <SelectItem key={t.code} value={t.code}>
                          {t.title} ({t.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedTpl && (
                  <div className="p-3 bg-muted rounded-lg space-y-2">
                    <p className="font-semibold text-sm">{selectedTpl.title}</p>
                    <p className="text-sm text-muted-foreground">{selectedTpl.body}</p>
                    <div className="flex gap-1">
                      {selectedTpl.default_channels.map((ch) => (
                        <Badge key={ch} variant="secondary" className="text-xs">
                          {ch}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <Label>عنوان الإشعار</Label>
                  <Input
                    value={customTitle}
                    onChange={(e) => setCustomTitle(e.target.value)}
                    placeholder="عنوان الإشعار..."
                    maxLength={200}
                  />
                </div>
                <div>
                  <Label>محتوى الإشعار</Label>
                  <Textarea
                    value={customBody}
                    onChange={(e) => setCustomBody(e.target.value)}
                    placeholder="اكتب محتوى الإشعار هنا..."
                    rows={4}
                    maxLength={1000}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: Recipients */}
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
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={selectAll}>
                تحديد الكل
              </Button>
              <Button variant="outline" size="sm" onClick={deselectAll}>
                إلغاء الكل
              </Button>
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
                  <Badge variant="outline" className="text-xs">
                    +{selectedRecipients.length - 5} آخرين
                  </Badge>
                )}
              </div>
            )}

            <ScrollArea className="h-56 border rounded-lg">
              <div className="p-2 space-y-1">
                {filteredProfiles.map((p) => (
                  <label
                    key={p.id}
                    className="flex items-center gap-2 p-2 rounded hover:bg-muted/50 cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedRecipients.includes(p.id)}
                      onCheckedChange={() => toggleRecipient(p.id)}
                    />
                    <span className="text-sm flex-1">{p.full_name}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {roleLabels[p.role] || p.role}
                    </Badge>
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
          {sending ? "جارٍ الإرسال..." : `إرسال الإشعار (${selectedRecipients.length})`}
        </Button>
      </div>
    </div>
  );
};

export default SendNotification;
