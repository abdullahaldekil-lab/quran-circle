import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LogIn, LogOut, MapPin, Loader2, Camera, StopCircle } from "lucide-react";
import { BrowserQRCodeReader } from "@zxing/browser";

type Action = "check_in" | "check_out";

const StaffQrCheckin = () => {
  const { toast } = useToast();
  const { profile } = useAuth();
  const [code, setCode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const readerRef = useRef<BrowserQRCodeReader | null>(null);
  const controlsRef = useRef<any>(null);

  useEffect(() => () => { controlsRef.current?.stop(); }, []);

  const startScan = async () => {
    try {
      setScanning(true);
      const reader = new BrowserQRCodeReader();
      readerRef.current = reader;
      const controls = await reader.decodeFromVideoDevice(undefined, videoRef.current!, (res, err, ctrl) => {
        if (res) {
          setCode(res.getText());
          setScanning(false);
          ctrl.stop();
          toast({ title: "تم قراءة الرمز" });
        }
      });
      controlsRef.current = controls;
    } catch (e: any) {
      setScanning(false);
      toast({ title: "خطأ في الكاميرا", description: e.message, variant: "destructive" });
    }
  };

  const stopScan = () => { controlsRef.current?.stop(); setScanning(false); };

  const submit = async (action: Action) => {
    if (!code) { toast({ title: "أدخل رمز QR أولاً", variant: "destructive" }); return; }
    if (!navigator.geolocation) { toast({ title: "المتصفح لا يدعم GPS", variant: "destructive" }); return; }
    setBusy(true);
    setResult(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { data, error } = await supabase.functions.invoke("staff-qr-checkin", {
            body: { code: code.trim(), latitude: pos.coords.latitude, longitude: pos.coords.longitude, action },
          });
          if (error) throw error;
          if ((data as any)?.error) throw new Error((data as any).error);
          setResult(data);
          toast({ title: action === "check_in" ? "تم تسجيل الحضور" : "تم تسجيل الانصراف" });
        } catch (e: any) {
          toast({ title: "فشل", description: e.message, variant: "destructive" });
          setResult({ error: e.message });
        } finally {
          setBusy(false);
        }
      },
      (err) => {
        setBusy(false);
        toast({ title: "تعذّر تحديد الموقع", description: err.message, variant: "destructive" });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="max-w-lg mx-auto space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold">بصمة الحضور</h1>
        <p className="text-muted-foreground">{profile?.full_name}</p>
      </div>

      <Card>
        <CardHeader><CardTitle>1. امسح رمز QR</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          {scanning ? (
            <>
              <video ref={videoRef} className="w-full rounded-lg bg-black aspect-square object-cover" />
              <Button variant="outline" className="w-full" onClick={stopScan}>
                <StopCircle className="w-4 h-4 ml-1" />إيقاف الكاميرا
              </Button>
            </>
          ) : (
            <Button variant="outline" className="w-full" onClick={startScan}>
              <Camera className="w-4 h-4 ml-1" />فتح الكاميرا للمسح
            </Button>
          )}
          <div className="text-center text-xs text-muted-foreground">أو أدخل الرمز يدوياً</div>
          <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="HW-QR-XXXXXX-XXXX" className="font-mono text-center" />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>2. سجّل حضورك / انصرافك</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Alert className="text-xs">
            <MapPin className="w-4 h-4" />
            <AlertDescription>سيتم قراءة موقعك للتحقق من تواجدك ضمن نطاق النقطة.</AlertDescription>
          </Alert>
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => submit("check_in")} disabled={busy || !code} className="bg-emerald-600 hover:bg-emerald-700">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <><LogIn className="w-4 h-4 ml-1" />حضور</>}
            </Button>
            <Button onClick={() => submit("check_out")} disabled={busy || !code} variant="outline">
              <LogOut className="w-4 h-4 ml-1" />انصراف
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Alert variant={result.error ? "destructive" : "default"}>
          <AlertDescription>
            {result.error ? result.error : (
              <div className="space-y-1 text-sm">
                <div>✅ {result.action === "check_in" ? "تم تسجيل الحضور" : "تم تسجيل الانصراف"}</div>
                <div>الحالة: <strong>{result.status || "-"}</strong></div>
                <div>الموقع: {result.qr_label} — على بعد {result.distance_meters}م</div>
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
};

export default StaffQrCheckin;
