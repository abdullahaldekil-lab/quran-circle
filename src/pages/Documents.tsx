import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { Plus, ExternalLink, FileText, Trash2 } from "lucide-react";

const categoryLabels: Record<string, string> = {
  policies: "سياسات",
  forms: "نماذج",
  reports: "تقارير",
  general: "عام",
};

const visibilityLabels: Record<string, string> = {
  admin_only: "الإدارة فقط",
  teachers: "المعلمون",
  guardians: "أولياء الأمور",
  all: "الجميع",
};

const Documents = () => {
  const { isManager } = useRole();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState("all_categories");
  const [form, setForm] = useState({ title: "", description: "", external_url: "", category: "general", visibility: "all" });

  const { data: documents = [], isLoading } = useQuery({
    queryKey: ["documents", filterCategory],
    queryFn: async () => {
      let q = supabase.from("documents").select("*").order("created_at", { ascending: false });
      if (filterCategory !== "all_categories") q = q.eq("category", filterCategory);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("documents").insert(form);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast({ title: "تمت الإضافة بنجاح" });
      setForm({ title: "", description: "", external_url: "", category: "general", visibility: "all" });
      setOpen(false);
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("documents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast({ title: "تم الحذف" });
    },
  });

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">المستندات والروابط الرسمية</h1>
          <p className="text-muted-foreground">إدارة المستندات والروابط المركزية</p>
        </div>
        <div className="flex gap-3 items-center">
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all_categories">الكل</SelectItem>
              {Object.entries(categoryLabels).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isManager && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="w-4 h-4 ml-2" />إضافة مستند</Button>
              </DialogTrigger>
              <DialogContent dir="rtl">
                <DialogHeader><DialogTitle>إضافة مستند جديد</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div><Label>العنوان</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
                  <div><Label>الوصف</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
                  <div><Label>الرابط</Label><Input value={form.external_url} onChange={e => setForm(f => ({ ...f, external_url: e.target.value }))} placeholder="https://..." /></div>
                  <div><Label>التصنيف</Label>
                    <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.entries(categoryLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>الظهور</Label>
                    <Select value={form.visibility} onValueChange={v => setForm(f => ({ ...f, visibility: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{Object.entries(visibilityLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <Button className="w-full" onClick={() => addMutation.mutate()} disabled={!form.title || !form.external_url || addMutation.isPending}>
                    {addMutation.isPending ? "جارٍ الإضافة..." : "إضافة"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">جارٍ التحميل...</p>
      ) : documents.length === 0 ? (
        <p className="text-muted-foreground text-center py-12">لا توجد مستندات</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {documents.map((doc: any) => (
            <Card key={doc.id} className="group">
              <CardHeader className="flex flex-row items-start justify-between pb-2">
                <div className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  <CardTitle className="text-base">{doc.title}</CardTitle>
                </div>
                {isManager && (
                  <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100" onClick={() => deleteMutation.mutate(doc.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                {doc.description && <p className="text-sm text-muted-foreground">{doc.description}</p>}
                <div className="flex gap-2 flex-wrap">
                  <Badge variant="secondary">{categoryLabels[doc.category] || doc.category}</Badge>
                  <Badge variant="outline">{visibilityLabels[doc.visibility] || doc.visibility}</Badge>
                </div>
                <a href={doc.external_url} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="w-full mt-2">
                    <ExternalLink className="w-4 h-4 ml-2" />فتح الرابط
                  </Button>
                </a>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Documents;
