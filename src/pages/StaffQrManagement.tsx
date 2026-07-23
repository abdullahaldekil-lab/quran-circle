import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, MapPin, Trash2, QrCode as QrIcon, Loader2 } from "lucide-react";
import QRCode from "qrcode";

interface QrPoint {
  id: string;
  code: string;
  label: string;
  latitude: number;
  longitude: number;
  radius_meters: number;
  active: boolean;
}

const StaffQrManagement = () => {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [form, setForm] = useState({ label: "", latitude: "", longitude: "", radius_meters: "100" });
  const [previewFor, setPreviewFor] = useState<QrPoint | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  const { data: points = [], isLoading } = useQuery({
    queryKey: ["staff-qr-points"],
    queryFn: async () => {
      const { data, error } = await supabase.from("staff_checkin_qr").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as QrPoint[];
    },
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const code = `HW-QR-${Math.random().toString(36).slice(2, 8).toUpperCase()}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
      const { error } = await supabase.from("staff_checkin_qr").insert({
        code,
        label: form.label,
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        radius_meters: Number(form.radius_meters),
        active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["staff-qr-points"] });
      toast({ title: "تم إنشاء نقطة الحضور" });
      setDialogOpen(false);
      setForm({ label: "", latitude: "", longitude: "", radius_meters: "100" });
    },
    onError: (e: any) => toast({ title: "خطأ", description: e.message, variant: "destructive" }),
  });

  const toggleActive = useMutation({
    mutationFn: async (p: QrPoint) => {
      const { error } = await supabase.from("staff_checkin_qr").update({ active: !p.active }).eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["staff-qr-points"] }),
  });

  const removeMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("staff_checkin_qr").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["staff-qr-points"] }); toast({ title: "تم الحذف" }); },
  });

  const captureGps = () => {
    if (!navigator.geolocation) {
      toast({ title: "المتصفح لا يدعم تحديد الموقع", variant: "destructive" });
      return;
    }
    setGpsLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setForm((f) => ({ ...f, latitude: pos.coords.latitude.toFixed(6), longitude: pos.coords.longitude.toFixed(6) }));
        setGpsLoading(false);
        toast({ title: "تم التقاط الموقع" });
      },
      (err) => {
        setGpsLoading(false);
        toast({ title: "تعذّر تحديد الموقع", description: err.message, variant: "destructive" });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const showQr = async (p: QrPoint) => {
    const url = await QRCode.toDataURL(p.code, { width: 400, margin: 2 });
    setQrDataUrl(url);
    setPreviewFor(p);
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">نقاط بصمة الحضور (QR)</h1>
          <p className="text-muted-foreground">إدارة رموز QR ومواقع GPS لتسجيل حضور الموظفين</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="w-4 h-4 ml-1" />نقطة جديدة</Button>
          </DialogTrigger>
          <DialogContent dir="rtl">
            <DialogHeader><DialogTitle>إضافة نقطة حضور</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>الاسم / الموقع</Label>
                <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="المبنى الرئيسي" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>خط العرض</Label>
                  <Input value={form.latitude} onChange={(e) => setForm({ ...form, latitude: e.target.value })} />
                </div>
                <div>
                  <Label>خط الطول</Label>
                  <Input value={form.longitude} onChange={(e) => setForm({ ...form, longitude: e.target.value })} />
                </div>
              </div>
              <Button type="button" variant="outline" className="w-full" onClick={captureGps} disabled={gpsLoading}>
                {gpsLoading ? <Loader2 className="w-4 h-4 ml-1 animate-spin" /> : <MapPin className="w-4 h-4 ml-1" />}
                التقاط موقعي الحالي
              </Button>
              <div>
                <Label>نطاق السماح (متر)</Label>
                <Input type="number" value={form.radius_meters} onChange={(e) => setForm({ ...form, radius_meters: e.target.value })} />
              </div>
              <Button className="w-full" onClick={() => createMut.mutate()} disabled={!form.label || !form.latitude || !form.longitude || createMut.isPending}>
                حفظ
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="text-center py-8"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
      ) : points.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">لا توجد نقاط بعد. أضف نقطة أولى.</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {points.map((p) => (
            <Card key={p.id}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-base">{p.label}</CardTitle>
                  <Badge variant={p.active ? "default" : "secondary"}>{p.active ? "مُفعّل" : "موقوف"}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="text-muted-foreground">
                  <div className="flex items-center gap-1"><MapPin className="w-3 h-3" />{p.latitude}, {p.longitude}</div>
                  <div className="text-xs">نطاق: {p.radius_meters}م</div>
                  <div className="text-xs mt-1 font-mono bg-muted p-1 rounded">{p.code}</div>
                </div>
                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="flex items-center gap-2">
                    <Switch checked={p.active} onCheckedChange={() => toggleActive.mutate(p)} />
                    <span className="text-xs">تفعيل</span>
                  </div>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" onClick={() => showQr(p)}><QrIcon className="w-3 h-3" /></Button>
                    <Button size="sm" variant="outline" onClick={() => confirm("حذف؟") && removeMut.mutate(p.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!previewFor} onOpenChange={(o) => !o && setPreviewFor(null)}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>{previewFor?.label}</DialogTitle></DialogHeader>
          {qrDataUrl && (
            <div className="flex flex-col items-center gap-3">
              <img src={qrDataUrl} alt="QR" className="w-64 h-64" />
              <p className="text-xs text-muted-foreground font-mono">{previewFor?.code}</p>
              <Button onClick={() => {
                const a = document.createElement("a");
                a.href = qrDataUrl;
                a.download = `qr-${previewFor?.label}.png`;
                a.click();
              }}>تحميل PNG</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StaffQrManagement;
