import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { ScrollText, Plus, Pencil, Trash2, Eye, BookOpen, Users, CheckCircle, BarChart3, Settings, CalendarDays } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface NarrationSession {
  id: string;
  session_date: string;
  halaqa_id: string | null;
  title: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  halaqat?: { name: string } | null;
  _stats?: {
    total: number;
    passed: number;
    failed: number;
    absent: number;
  };
}

interface NarrationSettings {
  id: string;
  min_grade: number;
  max_grade: number;
  deduction_per_mistake: number;
  deduction_per_lahn: number;
  deduction_per_warning: number;
}

export default function QuranNarration() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const { role } = useRole();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showNewSessionDialog, setShowNewSessionDialog] = useState(false);
  const [editSession, setEditSession] = useState<NarrationSession | null>(null);
  const [form, setForm] = useState({
    session_date: new Date().toISOString().split("T")[0],
    halaqa_id: "",
    title: "",
    notes: "",
  });
  const [settingsForm, setSettingsForm] = useState<Partial<NarrationSettings>>({});

  const isManager = role === "manager";
  const canWrite = isManager || role === "teacher" || role === "assistant_teacher";

  // جلب الجلسات
  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["narration-sessions"],
    queryFn: async () => {
    const { data, error } = await supabase
        .from("narration_sessions" as any)
        .select(`
          *,
          halaqat(name)
        `)
        .order("session_date", { ascending: false });
      if (error) throw error;
      return (data as unknown) as NarrationSession[];
    },
  });

  // جلب إحصائيات كل جلسة
  const { data: allResults = [] } = useQuery({
    queryKey: ["narration-results-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("narration_results" as any)
        .select("session_id, status, grade");
      if (error) throw error;
      return (data as unknown) as { session_id: string; status: string; grade: number }[];
    },
  });

  // جلب الحلقات
  const { data: halaqat = [] } = useQuery({
    queryKey: ["halaqat-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("halaqat")
        .select("id, name")
        .eq("active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // جلب الإعدادات
  const { data: settings } = useQuery({
    queryKey: ["narration-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("narration_settings" as any)
        .select("*")
        .limit(1)
        .single();
      if (error) throw error;
      return (data as unknown) as NarrationSettings;
    },
  });

  // حساب إحصائيات كل جلسة
  const getSessionStats = (sessionId: string) => {
    const results = allResults.filter((r) => r.session_id === sessionId);
    return {
      total: results.length,
      passed: results.filter((r) => r.status === "pass").length,
      failed: results.filter((r) => r.status === "fail").length,
      absent: results.filter((r) => r.status === "absent").length,
    };
  };

  // إحصائيات عامة
  const totalSessions = sessions.length;
  const totalParticipants = allResults.length;
  const totalPassed = allResults.filter((r) => r.status === "pass").length;
  const avgPassRate = totalParticipants > 0 ? Math.round((totalPassed / totalParticipants) * 100) : 0;
  const totalHizbPresented = allResults.filter((r) => r.status !== "absent" && r.status !== "pending").length;

  // إنشاء/تعديل جلسة
  const sessionMutation = useMutation({
    mutationFn: async (data: typeof form & { id?: string }) => {
      const payload = {
        session_date: data.session_date,
        halaqa_id: data.halaqa_id || null,
        title: data.title || null,
        notes: data.notes || null,
        created_by: profile?.id,
      };
      if (data.id) {
        const { error } = await supabase
          .from("narration_sessions" as any)
          .update(payload)
          .eq("id", data.id);
        if (error) throw error;
        return data.id;
      } else {
        const { data: created, error } = await supabase
          .from("narration_sessions" as any)
          .insert(payload)
          .select()
          .single();
        if (error) throw error;
        return (created as any).id;
      }
    },
    onSuccess: (sessionId, variables) => {
      queryClient.invalidateQueries({ queryKey: ["narration-sessions"] });
      setShowNewSessionDialog(false);
      setEditSession(null);
      resetForm();
      if (!variables.id) {
        toast({ title: "تم إنشاء الجلسة بنجاح" });
        navigate(`/quran-narration/${sessionId}`);
      } else {
        toast({ title: "تم تحديث الجلسة بنجاح" });
      }
    },
    onError: () => toast({ title: "حدث خطأ", variant: "destructive" }),
  });

  // حذف جلسة
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("narration_sessions" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["narration-sessions"] });
      queryClient.invalidateQueries({ queryKey: ["narration-results-all"] });
      toast({ title: "تم حذف الجلسة" });
    },
    onError: () => toast({ title: "حدث خطأ في الحذف", variant: "destructive" }),
  });

  // تحديث الإعدادات
  const settingsMutation = useMutation({
    mutationFn: async (data: Partial<NarrationSettings>) => {
      const { error } = await supabase
        .from("narration_settings" as any)
        .update(data)
        .eq("id", settings?.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["narration-settings"] });
      toast({ title: "تم حفظ الإعدادات بنجاح" });
    },
    onError: () => toast({ title: "حدث خطأ في حفظ الإعدادات", variant: "destructive" }),
  });

  const resetForm = () => {
    setForm({
      session_date: new Date().toISOString().split("T")[0],
      halaqa_id: "",
      title: "",
      notes: "",
    });
  };

  const openEdit = (session: NarrationSession) => {
    setEditSession(session);
    setForm({
      session_date: session.session_date,
      halaqa_id: session.halaqa_id || "",
      title: session.title || "",
      notes: session.notes || "",
    });
    setShowNewSessionDialog(true);
  };

  const handleSubmit = () => {
    if (!form.session_date) {
      toast({ title: "التاريخ مطلوب", variant: "destructive" });
      return;
    }
    sessionMutation.mutate(editSession ? { ...form, id: editSession.id } : form);
  };

  const handleSettingsSave = () => {
    settingsMutation.mutate(settingsForm);
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <ScrollText className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">يوم السرد القرآني</h1>
            <p className="text-sm text-muted-foreground">إدارة جلسات السرد ونتائج الطلاب</p>
          </div>
        </div>
        {canWrite && (
          <Dialog open={showNewSessionDialog} onOpenChange={(open) => {
            setShowNewSessionDialog(open);
            if (!open) { setEditSession(null); resetForm(); }
          }}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                جلسة جديدة
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md" dir="rtl">
              <DialogHeader>
                <DialogTitle>{editSession ? "تعديل الجلسة" : "إنشاء جلسة سرد جديدة"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label>تاريخ الجلسة *</Label>
                  <Input
                    type="date"
                    value={form.session_date}
                    onChange={(e) => setForm((p) => ({ ...p, session_date: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>الحلقة</Label>
                  <Select value={form.halaqa_id} onValueChange={(v) => setForm((p) => ({ ...p, halaqa_id: v }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر الحلقة" />
                    </SelectTrigger>
                    <SelectContent position="popper" className="z-[200]">
                      {halaqat.map((h) => (
                        <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>عنوان الجلسة</Label>
                  <Input
                    placeholder="مثال: سرد الربع الأول"
                    value={form.title}
                    onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>ملاحظات</Label>
                  <Textarea
                    placeholder="ملاحظات عامة على الجلسة"
                    value={form.notes}
                    onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                    rows={3}
                  />
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <Button variant="outline" onClick={() => { setShowNewSessionDialog(false); setEditSession(null); resetForm(); }}>إلغاء</Button>
                  <Button onClick={handleSubmit} disabled={sessionMutation.isPending}>
                    {sessionMutation.isPending ? "جارٍ الحفظ..." : editSession ? "حفظ التعديلات" : "إنشاء والانتقال للإدخال"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* الإحصائيات */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <CalendarDays className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">إجمالي الجلسات</p>
              <p className="text-2xl font-bold">{totalSessions}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-sky-500/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-sky-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">مجموع السجلات</p>
              <p className="text-2xl font-bold">{totalParticipants}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">متوسط الاجتياز</p>
              <p className="text-2xl font-bold">{avgPassRate}%</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">المجتازون</p>
              <p className="text-2xl font-bold">{totalPassed}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="sessions" dir="rtl">
        <TabsList>
          <TabsTrigger value="sessions" className="gap-2">
            <BookOpen className="w-4 h-4" />
            الجلسات
          </TabsTrigger>
          <TabsTrigger value="reports" className="gap-2" onClick={() => navigate("/quran-narration/reports")}>
            <BarChart3 className="w-4 h-4" />
            التقارير
          </TabsTrigger>
          {isManager && (
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="w-4 h-4" />
              الإعدادات
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="sessions" className="mt-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                قائمة جلسات السرد
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-8 text-center text-muted-foreground">جارٍ التحميل...</div>
              ) : sessions.length === 0 ? (
                <div className="p-12 text-center">
                  <ScrollText className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
                  <p className="text-muted-foreground">لا توجد جلسات بعد</p>
                  {canWrite && (
                    <p className="text-sm text-muted-foreground mt-1">اضغط "جلسة جديدة" للبدء</p>
                  )}
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">التاريخ</TableHead>
                      <TableHead className="text-right">الحلقة</TableHead>
                      <TableHead className="text-right">العنوان</TableHead>
                      <TableHead className="text-center">الحضور</TableHead>
                      <TableHead className="text-center">المجتازون</TableHead>
                      <TableHead className="text-center">الراسبون</TableHead>
                      <TableHead className="text-center">نسبة الاجتياز</TableHead>
                      <TableHead className="text-center">الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessions.map((session) => {
                      const stats = getSessionStats(session.id);
                      const passRate = stats.total - stats.absent > 0
                        ? Math.round((stats.passed / (stats.total - stats.absent)) * 100)
                        : 0;
                      return (
                        <TableRow key={session.id}>
                          <TableCell className="font-medium">
                            {new Date(session.session_date).toLocaleDateString("ar-SA")}
                          </TableCell>
                          <TableCell>
                            {(session as any).halaqat?.name || (
                              <span className="text-muted-foreground text-sm">غير محدد</span>
                            )}
                          </TableCell>
                          <TableCell>{session.title || <span className="text-muted-foreground text-sm">—</span>}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline">{stats.total}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-200">{stats.passed}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className="bg-destructive/10 text-destructive border-destructive/20">{stats.failed}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge
                              className={
                                passRate >= 70
                                  ? "bg-emerald-500/10 text-emerald-700 border-emerald-200"
                                  : passRate >= 50
                                  ? "bg-amber-500/10 text-amber-700 border-amber-200"
                                  : "bg-destructive/10 text-destructive border-destructive/20"
                              }
                            >
                              {passRate}%
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => navigate(`/quran-narration/${session.id}`)}
                                title="عرض التفاصيل"
                              >
                                <Eye className="w-4 h-4" />
                              </Button>
                              {canWrite && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => openEdit(session)}
                                  title="تعديل"
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                              )}
                              {isManager && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" title="حذف">
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent dir="rtl">
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        سيتم حذف الجلسة وجميع نتائج الطلاب المرتبطة بها. هذا الإجراء لا يمكن التراجع عنه.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>إلغاء</AlertDialogCancel>
                                      <AlertDialogAction
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        onClick={() => deleteMutation.mutate(session.id)}
                                      >
                                        حذف
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {isManager && (
          <TabsContent value="settings" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Settings className="w-4 h-4 text-primary" />
                  إعدادات نظام السرد
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {settings && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label>الحد الأدنى للاجتياز</Label>
                        <Input
                          type="number"
                          defaultValue={settings.min_grade}
                          onChange={(e) =>
                            setSettingsForm((p) => ({ ...p, min_grade: Number(e.target.value) }))
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>الحد الأقصى للدرجة</Label>
                        <Input
                          type="number"
                          defaultValue={settings.max_grade}
                          onChange={(e) =>
                            setSettingsForm((p) => ({ ...p, max_grade: Number(e.target.value) }))
                          }
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <Label>خصم لكل خطأ</Label>
                        <Input
                          type="number"
                          step="0.5"
                          defaultValue={settings.deduction_per_mistake}
                          onChange={(e) =>
                            setSettingsForm((p) => ({ ...p, deduction_per_mistake: Number(e.target.value) }))
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>خصم لكل لحن</Label>
                        <Input
                          type="number"
                          step="0.5"
                          defaultValue={settings.deduction_per_lahn}
                          onChange={(e) =>
                            setSettingsForm((p) => ({ ...p, deduction_per_lahn: Number(e.target.value) }))
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>خصم لكل تنبيه</Label>
                        <Input
                          type="number"
                          step="0.5"
                          defaultValue={settings.deduction_per_warning}
                          onChange={(e) =>
                            setSettingsForm((p) => ({ ...p, deduction_per_warning: Number(e.target.value) }))
                          }
                        />
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
                      <p className="font-medium mb-1">معادلة الدرجة:</p>
                      <p>الدرجة = {settings.max_grade} − (أخطاء × {settings.deduction_per_mistake}) − (لحون × {settings.deduction_per_lahn}) − (تنبيهات × {settings.deduction_per_warning})</p>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <Label>أوجه لكل حزب</Label>
                        <Input
                          type="number"
                          defaultValue={(settings as any).pages_per_hizb ?? 10}
                          onChange={(e) =>
                            setSettingsForm((p) => ({ ...p, pages_per_hizb: Number(e.target.value) }))
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>الحد الأدنى للأحزاب</Label>
                        <Input
                          type="number"
                          defaultValue={(settings as any).min_hizb_required ?? 1}
                          onChange={(e) =>
                            setSettingsForm((p) => ({ ...p, min_hizb_required: Number(e.target.value) }))
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>الحد الأدنى للأوجه</Label>
                        <Input
                          type="number"
                          defaultValue={(settings as any).min_pages_required ?? 10}
                          onChange={(e) =>
                            setSettingsForm((p) => ({ ...p, min_pages_required: Number(e.target.value) }))
                          }
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-1.5">
                        <Label>وزن الحفظ</Label>
                        <Input
                          type="number"
                          step="0.1"
                          defaultValue={(settings as any).memorization_weight ?? 0.5}
                          onChange={(e) =>
                            setSettingsForm((p) => ({ ...p, memorization_weight: Number(e.target.value) }))
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>وزن الإتقان</Label>
                        <Input
                          type="number"
                          step="0.1"
                          defaultValue={(settings as any).mastery_weight ?? 0.3}
                          onChange={(e) =>
                            setSettingsForm((p) => ({ ...p, mastery_weight: Number(e.target.value) }))
                          }
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>وزن الأداء</Label>
                        <Input
                          type="number"
                          step="0.1"
                          defaultValue={(settings as any).performance_weight ?? 0.2}
                          onChange={(e) =>
                            setSettingsForm((p) => ({ ...p, performance_weight: Number(e.target.value) }))
                          }
                        />
                      </div>
                    </div>
                    <Button onClick={handleSettingsSave} disabled={settingsMutation.isPending}>
                      {settingsMutation.isPending ? "جارٍ الحفظ..." : "حفظ الإعدادات"}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
