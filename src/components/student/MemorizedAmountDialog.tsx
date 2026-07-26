import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { BookOpen, Sparkles, Wand2 } from "lucide-react";
import { MUSHAF_TOTAL_PAGES } from "@/lib/mushaf";
import {
  juzEquivalent,
  lastPageOfJuzRange,
  memorizedPercent,
  pagesForJuzRange,
  parseLegacyMemorizationAmount,
} from "@/lib/memorization";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: string;
  studentName: string;
  /** Free-text amount captured on the registration form, if any. */
  memorizationAmount?: string | null;
  currentPages?: number | null;
  onSaved: () => void;
}

/**
 * Sets a student's baseline memorized portion (المحفوظ).
 *
 * The baseline is what the student already knew before the app started tracking them;
 * recitation adds to it from there. It is stored in `student_memorization_baseline` and
 * mirrored onto `students.total_memorized_pages`, which every progress bar reads.
 */
const MemorizedAmountDialog = ({
  open,
  onOpenChange,
  studentId,
  studentName,
  memorizationAmount,
  currentPages,
  onSaved,
}: Props) => {
  const [pages, setPages] = useState(0);
  const [juzFrom, setJuzFrom] = useState(1);
  const [juzTo, setJuzTo] = useState(1);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoaded(false);
    (supabase as any)
      .from("student_memorization_baseline")
      .select("baseline_pages, baseline_up_to_page, note")
      .eq("student_id", studentId)
      .maybeSingle()
      .then(({ data }: any) => {
        setPages(data?.baseline_pages ?? currentPages ?? 0);
        setNote(data?.note ?? "");
        setLoaded(true);
      });
  }, [open, studentId, currentPages]);

  const juzPages = pagesForJuzRange(juzFrom, juzTo);

  const applyJuzRange = () => {
    if (juzPages <= 0) {
      toast.error("النطاق غير صحيح — تأكد أن الجزء الأول قبل الأخير");
      return;
    }
    setPages(juzPages);
  };

  const applyLegacyGuess = () => {
    const guess = parseLegacyMemorizationAmount(memorizationAmount);
    if (guess == null) {
      toast.error("تعذّر استنتاج المقدار من نص التسجيل");
      return;
    }
    setPages(guess);
    toast.success(`اقتراح: ${guess} صفحة — راجعه قبل الحفظ`);
  };

  const save = async () => {
    const clamped = Math.max(0, Math.min(MUSHAF_TOTAL_PAGES, Math.round(pages)));
    setSaving(true);
    try {
      // The baseline position: where the student had reached. Deriving it from the
      // page count keeps recitation from re-counting pages already in the baseline.
      const upTo = clamped > 0 ? clamped : null;

      const { error: baselineErr } = await (supabase as any)
        .from("student_memorization_baseline")
        .upsert(
          {
            student_id: studentId,
            baseline_pages: clamped,
            baseline_up_to_page: upTo,
            source: "manual",
            note: note || null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "student_id" },
        );
      if (baselineErr) throw baselineErr;

      // Keep the number every progress bar reads in step with the baseline. It only
      // moves up: recitation may already have taken the student past it.
      const { data: student } = await supabase
        .from("students")
        .select("total_memorized_pages")
        .eq("id", studentId)
        .maybeSingle();

      const next = Math.max(clamped, student?.total_memorized_pages || 0);
      const { error: studentErr } = await supabase
        .from("students")
        .update({ total_memorized_pages: next })
        .eq("id", studentId);
      if (studentErr) throw studentErr;

      toast.success("تم تحديث المحفوظ");
      onOpenChange(false);
      onSaved();
    } catch (e: any) {
      toast.error(e.message || "تعذّر الحفظ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            محفوظ الطالب — {studentName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border p-3 text-center">
            <p className="text-2xl font-bold">{pages} صفحة</p>
            <p className="text-xs text-muted-foreground">
              ≈ {juzEquivalent(pages)} جزء — {memorizedPercent(pages)}% من المصحف
            </p>
          </div>

          <Tabs defaultValue="pages">
            <TabsList className="w-full">
              <TabsTrigger value="pages" className="flex-1">بالصفحات</TabsTrigger>
              <TabsTrigger value="juz" className="flex-1">بالأجزاء</TabsTrigger>
            </TabsList>

            <TabsContent value="pages" className="space-y-2 pt-3">
              <Label>عدد الصفحات المحفوظة</Label>
              <Input
                type="number"
                min={0}
                max={MUSHAF_TOTAL_PAGES}
                value={pages}
                onChange={(e) => setPages(Number(e.target.value) || 0)}
              />
            </TabsContent>

            <TabsContent value="juz" className="space-y-2 pt-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>من الجزء</Label>
                  <Input type="number" min={1} max={30} value={juzFrom}
                    onChange={(e) => setJuzFrom(Number(e.target.value) || 1)} />
                </div>
                <div>
                  <Label>إلى الجزء</Label>
                  <Input type="number" min={1} max={30} value={juzTo}
                    onChange={(e) => setJuzTo(Number(e.target.value) || 1)} />
                </div>
              </div>
              <Button variant="outline" size="sm" className="w-full" onClick={applyJuzRange}>
                <Sparkles className="w-4 h-4 ml-1" />
                احتساب {juzPages > 0 ? `(${juzPages} صفحة)` : ""}
              </Button>
              {lastPageOfJuzRange(juzFrom, juzTo) && (
                <p className="text-xs text-muted-foreground text-center">
                  ينتهي عند صفحة {lastPageOfJuzRange(juzFrom, juzTo)}
                </p>
              )}
            </TabsContent>
          </Tabs>

          {memorizationAmount && (
            <div className="rounded-lg border bg-muted/40 p-3 space-y-2">
              <p className="text-xs text-muted-foreground">
                المحفوظ عند التسجيل (نص): <span className="font-medium text-foreground">{memorizationAmount}</span>
              </p>
              <Button variant="ghost" size="sm" className="w-full" onClick={applyLegacyGuess}>
                <Wand2 className="w-4 h-4 ml-1" />استنتاج المقدار من النص
              </Button>
            </div>
          )}

          <div className="space-y-1">
            <Label>ملاحظة (اختياري)</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="مصدر المعلومة مثلاً" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={save} disabled={saving || !loaded}>
            {saving ? "جارٍ الحفظ..." : "حفظ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MemorizedAmountDialog;
