import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Copy, Download, Printer, QrCode } from "lucide-react";
import { enrollQrFileName, enrollUrl } from "@/lib/enrollLink";

/**
 * Shows a printable QR code for the public registration link (/enroll) so it can be
 * put on a poster or a WhatsApp broadcast instead of asking families to type a URL.
 *
 * Uses the same `qrcode` call shape as the staff check-in QR (StaffQrManagement.tsx).
 */
const RegistrationQrDialog = () => {
  const [open, setOpen] = useState(false);
  const [dataUrl, setDataUrl] = useState("");
  const url = enrollUrl(typeof window !== "undefined" ? window.location.origin : "");

  useEffect(() => {
    if (!open) return;
    QRCode.toDataURL(url, { width: 512, margin: 2 })
      .then(setDataUrl)
      .catch(() => toast.error("تعذّر توليد رمز QR"));
  }, [open, url]);

  const copyLink = () => {
    navigator.clipboard.writeText(url);
    toast.success("تم نسخ رابط التسجيل");
  };

  const download = () => {
    if (!dataUrl) return;
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = enrollQrFileName();
    a.click();
  };

  const print = () => {
    if (!dataUrl) return;
    const w = window.open("", "_blank", "width=680,height=880");
    if (!w) {
      toast.error("تعذّر فتح نافذة الطباعة — تحقّق من مانع النوافذ المنبثقة");
      return;
    }
    w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head>
      <meta charset="utf-8" />
      <title>رمز التسجيل</title>
      <style>
        body { font-family: system-ui, sans-serif; text-align: center; padding: 48px 24px; }
        h1 { font-size: 28px; margin-bottom: 4px; }
        p  { color: #555; margin-top: 0; }
        img { width: 340px; height: 340px; margin: 24px auto; display: block; }
        .url { direction: ltr; font-size: 14px; color: #333; word-break: break-all; }
      </style>
    </head><body>
      <h1>التسجيل في المجمع</h1>
      <p>امسح الرمز بكاميرا الجوال لفتح استمارة التسجيل</p>
      <img src="${dataUrl}" alt="رمز التسجيل" />
      <p class="url">${url}</p>
    </body></html>`);
    w.document.close();
    w.focus();
    w.print();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <QrCode className="w-4 h-4 ml-2" />
          باركود التسجيل
        </Button>
      </DialogTrigger>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>باركود رابط التسجيل</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            امسح الرمز بكاميرا الجوال لفتح استمارة التسجيل مباشرة.
          </p>
          {dataUrl ? (
            <img
              src={dataUrl}
              alt="رمز التسجيل"
              className="mx-auto w-56 h-56 rounded-lg border bg-white p-2"
            />
          ) : (
            <div className="mx-auto w-56 h-56 rounded-lg border flex items-center justify-center text-sm text-muted-foreground">
              جارٍ توليد الرمز...
            </div>
          )}
          <p className="text-xs text-muted-foreground break-all" dir="ltr">{url}</p>
          <div className="grid grid-cols-3 gap-2">
            <Button variant="outline" size="sm" onClick={copyLink}>
              <Copy className="w-4 h-4 ml-1" />نسخ
            </Button>
            <Button variant="outline" size="sm" onClick={download} disabled={!dataUrl}>
              <Download className="w-4 h-4 ml-1" />تحميل
            </Button>
            <Button variant="outline" size="sm" onClick={print} disabled={!dataUrl}>
              <Printer className="w-4 h-4 ml-1" />طباعة
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RegistrationQrDialog;
