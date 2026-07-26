import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Crosshair, Loader2 } from "lucide-react";
import { MUSHAF_TOTAL_PAGES, mushafPageImage, pageToJuz } from "@/lib/mushaf";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title?: string;
  /** Plan bounds (mushaf page numbers) — navigation stays inside them when provided. */
  pageFrom?: number | null;
  pageTo?: number | null;
  /** Auto-position: the page the student should be on now (updates as targets are met). */
  currentPage?: number | null;
  /** Today's target range, highlighted in the header. */
  todayFrom?: number | null;
  todayTo?: number | null;
}

export default function MushafViewer({
  open,
  onOpenChange,
  title = "المصحف",
  pageFrom,
  pageTo,
  currentPage,
  todayFrom,
  todayTo,
}: Props) {
  const min = pageFrom || 1;
  const max = pageTo || MUSHAF_TOTAL_PAGES;
  const startAt = useMemo(
    () => Math.min(max, Math.max(min, Math.round(currentPage || todayFrom || min))),
    [min, max, currentPage, todayFrom],
  );
  const [page, setPage] = useState(startAt);
  const [loading, setLoading] = useState(true);

  // Auto-sync whenever the student's position changes or the viewer reopens.
  useEffect(() => { if (open) { setPage(startAt); setLoading(true); } }, [open, startAt]);

  const go = (delta: number) => {
    setPage((p) => {
      const n = Math.min(max, Math.max(min, p + delta));
      if (n !== p) setLoading(true);
      return n;
    });
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(-1);
      if (e.key === "ArrowLeft") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, min, max]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-3xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap text-base">
            {title}
            <Badge variant="outline">الجزء {pageToJuz(page)}</Badge>
            <Badge variant="secondary">صفحة {page}</Badge>
            {todayFrom && todayTo && (
              <Badge className="bg-primary text-primary-foreground">
                مقرر اليوم: {todayFrom}–{todayTo}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between gap-2 mb-2">
          <Button size="sm" variant="outline" onClick={() => go(-1)} disabled={page <= min}>
            <ChevronRight className="w-4 h-4 ml-1" />السابق
          </Button>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="ghost" onClick={() => { setPage(startAt); setLoading(true); }}>
              <Crosshair className="w-4 h-4 ml-1" />موضع الطالب ({startAt})
            </Button>
            <span className="text-xs text-muted-foreground">النطاق {min}–{max}</span>
          </div>
          <Button size="sm" variant="outline" onClick={() => go(1)} disabled={page >= max}>
            التالي<ChevronLeft className="w-4 h-4 mr-1" />
          </Button>
        </div>

        <div className="relative bg-muted/30 rounded-lg border min-h-[420px] flex items-center justify-center">
          {loading && <Loader2 className="w-6 h-6 animate-spin text-muted-foreground absolute" />}
          <img
            key={page}
            src={mushafPageImage(page)}
            alt={`صفحة ${page} من المصحف`}
            loading="lazy"
            onLoad={() => setLoading(false)}
            onError={() => setLoading(false)}
            className="max-h-[70vh] w-auto mx-auto rounded"
          />
        </div>
        <p className="text-[11px] text-muted-foreground text-center mt-1">
          مصحف المدينة (حفص) · يتم تحديث الموضع تلقائيًا حسب ما أنجزه الطالب
        </p>
      </DialogContent>
    </Dialog>
  );
}
