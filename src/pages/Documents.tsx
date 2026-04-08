import { useState, useRef } from "react";
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
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { Plus, ExternalLink, FileText, Trash2, Upload, Download, Image, FileSpreadsheet, File } from "lucide-react";

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

const getFileIcon = (fileType: string | null) => {
  if (!fileType) return <FileText className="w-5 h-5 text-primary" />;
  if (fileType.includes("pdf")) return <FileText className="w-5 h-5 text-destructive" />;
  if (fileType.includes("word") || fileType.includes("doc")) return <File className="w-5 h-5 text-primary" />;
  if (fileType.includes("image") || fileType.includes("jpg") || fileType.includes("png")) return <Image className="w-5 h-5 text-success" />;
  if (fileType.includes("sheet") || fileType.includes("xls")) return <FileSpreadsheet className="w-5 h-5 text-success" />;
  return <FileText className="w-5 h-5 text-primary" />;
};

const Documents = () => {
  const { isManager } = useRole();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState("all_categories");
  const [uploadMode, setUploadMode] = useState<"link" | "file">("link");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
      if (uploadMode === "file" && selectedFile) {
        setUploading(true);
        setUploadProgress(10);

        const ext = selectedFile.name.split(".").pop() || "file";
        const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

        setUploadProgress(30);
        const { error: uploadError } = await supabase.storage
          .from("documents")
          .upload(path, selectedFile);

        if (uploadError) throw uploadError;
        setUploadProgress(70);

        const { data: urlData } = supabase.storage.from("documents").getPublicUrl(path);
        const fileUrl = urlData.publicUrl;

        setUploadProgress(90);
        const { error } = await supabase.from("documents").insert({
          ...form,
          external_url: fileUrl,
          file_url: fileUrl,
          file_type: selectedFile.type || ext,
          file_size: selectedFile.size,
        });
        if (error) throw error;
        setUploadProgress(100);
        setUploading(false);
      } else {
        const { error } = await supabase.from("documents").insert(form);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast({ title: "تمت الإضافة بنجاح" });
      resetForm();
    },
    onError: (e: any) => {
      setUploading(false);
      toast({ title: "خطأ", description: e.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (doc: any) => {
      // Delete from storage if it was uploaded
      if (doc.file_url) {
        const path = doc.file_url.split("/documents/")[1];
        if (path) await supabase.storage.from("documents").remove([path]);
      }
      const { error } = await supabase.from("documents").delete().eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      toast({ title: "تم الحذف" });
    },
  });

  const resetForm = () => {
    setForm({ title: "", description: "", external_url: "", category: "general", visibility: "all" });
    setSelectedFile(null);
    setUploadMode("link");
    setUploadProgress(0);
    setOpen(false);
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const canAdd = uploadMode === "file" ? !!form.title && !!selectedFile : !!form.title && !!form.external_url;

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
            <Dialog open={open} onOpenChange={(v) => { if (!v) resetForm(); setOpen(v); }}>
              <DialogTrigger asChild>
                <Button><Plus className="w-4 h-4 ml-2" />إضافة مستند</Button>
              </DialogTrigger>
              <DialogContent dir="rtl" className="max-w-lg">
                <DialogHeader><DialogTitle>إضافة مستند جديد</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div><Label>العنوان</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
                  <div><Label>الوصف</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>

                  {/* Toggle between link and file */}
                  <div className="flex gap-2">
                    <Button type="button" variant={uploadMode === "link" ? "default" : "outline"} size="sm" onClick={() => setUploadMode("link")}>
                      <ExternalLink className="w-4 h-4 ml-1" />رابط خارجي
                    </Button>
                    <Button type="button" variant={uploadMode === "file" ? "default" : "outline"} size="sm" onClick={() => setUploadMode("file")}>
                      <Upload className="w-4 h-4 ml-1" />رفع ملف
                    </Button>
                  </div>

                  {uploadMode === "link" ? (
                    <div><Label>الرابط</Label><Input value={form.external_url} onChange={e => setForm(f => ({ ...f, external_url: e.target.value }))} placeholder="https://..." /></div>
                  ) : (
                    <div className="space-y-2">
                      <Label>الملف</Label>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xlsx,.xls"
                        className="hidden"
                        onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                      />
                      <Button type="button" variant="outline" className="w-full" onClick={() => fileInputRef.current?.click()}>
                        <Upload className="w-4 h-4 ml-2" />
                        {selectedFile ? selectedFile.name : "اختر ملف"}
                      </Button>
                      {selectedFile && (
                        <p className="text-xs text-muted-foreground">{formatFileSize(selectedFile.size)}</p>
                      )}
                      {uploading && <Progress value={uploadProgress} className="h-2" />}
                    </div>
                  )}

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
                  <Button className="w-full" onClick={() => addMutation.mutate()} disabled={!canAdd || addMutation.isPending || uploading}>
                    {uploading ? "جارٍ الرفع..." : addMutation.isPending ? "جارٍ الإضافة..." : "إضافة"}
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
                  {getFileIcon(doc.file_type)}
                  <CardTitle className="text-base">{doc.title}</CardTitle>
                </div>
                {isManager && (
                  <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100" onClick={() => deleteMutation.mutate(doc)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                {doc.description && <p className="text-sm text-muted-foreground">{doc.description}</p>}
                <div className="flex gap-2 flex-wrap">
                  <Badge variant="secondary">{categoryLabels[doc.category] || doc.category}</Badge>
                  <Badge variant="outline">{visibilityLabels[doc.visibility] || doc.visibility}</Badge>
                  {doc.file_size && <Badge variant="outline" className="text-[10px]">{formatFileSize(doc.file_size)}</Badge>}
                </div>
                <div className="flex gap-2">
                  <a href={doc.file_url || doc.external_url} target="_blank" rel="noopener noreferrer" className="flex-1">
                    <Button variant="outline" size="sm" className="w-full">
                      <ExternalLink className="w-4 h-4 ml-2" />فتح
                    </Button>
                  </a>
                  {doc.file_url && (
                    <a href={doc.file_url} download className="flex-1">
                      <Button variant="outline" size="sm" className="w-full">
                        <Download className="w-4 h-4 ml-2" />تحميل
                      </Button>
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Documents;