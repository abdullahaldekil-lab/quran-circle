import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { Save, ChevronLeft, ChevronRight, ClipboardList, Mic } from "lucide-react";
import AudioRecorder from "@/components/AudioRecorder";

const Recitation = () => {
  const { user } = useAuth();
  const [halaqat, setHalaqat] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [selectedHalaqa, setSelectedHalaqa] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [audioUrl, setAudioUrl] = useState("");
  const [form, setForm] = useState({
    memorized_from: "",
    memorized_to: "",
    review_from: "",
    review_to: "",
    memorization_quality: 40,
    tajweed_score: 25,
    mistakes_count: 0,
    notes: "",
  });

  useEffect(() => {
    supabase.from("halaqat").select("*").eq("active", true).then(({ data }) => setHalaqat(data || []));
  }, []);

  useEffect(() => {
    if (selectedHalaqa) {
      supabase
        .from("students")
        .select("*")
        .eq("halaqa_id", selectedHalaqa)
        .eq("status", "active")
        .order("full_name")
        .then(({ data }) => {
          setStudents(data || []);
          setCurrentIndex(0);
          resetForm();
        });
    }
  }, [selectedHalaqa]);

  const resetForm = () => {
    setForm({
      memorized_from: "",
      memorized_to: "",
      review_from: "",
      review_to: "",
      memorization_quality: 40,
      tajweed_score: 25,
      mistakes_count: 0,
      notes: "",
    });
    setAudioUrl("");
  };

  const calcScore = () => {
    const q = form.memorization_quality;
    const t = form.tajweed_score;
    const m = Math.max(0, 20 - form.mistakes_count);
    return q + t + m;
  };

  const currentStudent = students[currentIndex];

  const handleSave = async () => {
    if (!currentStudent) return;
    setSaving(true);
    const totalScore = calcScore();
    const { error } = await supabase.from("recitation_records").insert({
      student_id: currentStudent.id,
      halaqa_id: selectedHalaqa,
      teacher_id: user?.id,
      memorized_from: form.memorized_from || null,
      memorized_to: form.memorized_to || null,
      review_from: form.review_from || null,
      review_to: form.review_to || null,
      memorization_quality: form.memorization_quality,
      tajweed_score: form.tajweed_score,
      mistakes_count: form.mistakes_count,
      total_score: totalScore,
      notes: form.notes || null,
      audio_url: audioUrl || null,
    });
    setSaving(false);
    if (error) {
      toast.error("حدث خطأ أثناء الحفظ");
      return;
    }
    toast.success(`تم حفظ تسميع ${currentStudent.full_name} - الدرجة: ${totalScore}`);
    if (currentIndex < students.length - 1) {
      setCurrentIndex(currentIndex + 1);
      resetForm();
    }
  };

  const totalScore = calcScore();
  const scoreColor = totalScore >= 80 ? "text-success" : totalScore >= 60 ? "text-warning" : "text-destructive";

  return (
    <div className="space-y-6 animate-fade-in max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">إدخال التسميع</h1>
        <p className="text-muted-foreground text-sm">سجّل تسميع الطلاب اليومي</p>
      </div>

      <div className="space-y-2">
        <Label>اختر الحلقة</Label>
        <Select value={selectedHalaqa} onValueChange={setSelectedHalaqa}>
          <SelectTrigger><SelectValue placeholder="اختر الحلقة" /></SelectTrigger>
          <SelectContent>
            {halaqat.map((h) => (
              <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedHalaqa && students.length > 0 && currentStudent && (
        <>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="icon" disabled={currentIndex >= students.length - 1} onClick={() => { setCurrentIndex(currentIndex + 1); resetForm(); }}>
                  <ChevronRight className="w-5 h-5" />
                </Button>
                <div className="text-center">
                  <h2 className="text-lg font-bold">{currentStudent.full_name}</h2>
                  <p className="text-sm text-muted-foreground">{currentIndex + 1} من {students.length}</p>
                </div>
                <Button variant="ghost" size="icon" disabled={currentIndex <= 0} onClick={() => { setCurrentIndex(currentIndex - 1); resetForm(); }}>
                  <ChevronLeft className="w-5 h-5" />
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-primary" />
                بيانات التسميع
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">الحفظ من</Label>
                  <Input placeholder="سورة / آية" value={form.memorized_from} onChange={(e) => setForm({ ...form, memorized_from: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">الحفظ إلى</Label>
                  <Input placeholder="سورة / آية" value={form.memorized_to} onChange={(e) => setForm({ ...form, memorized_to: e.target.value })} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">المراجعة من</Label>
                  <Input placeholder="سورة / آية" value={form.review_from} onChange={(e) => setForm({ ...form, review_from: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">المراجعة إلى</Label>
                  <Input placeholder="سورة / آية" value={form.review_to} onChange={(e) => setForm({ ...form, review_to: e.target.value })} />
                </div>
              </div>

              <div className="space-y-4 bg-muted/50 rounded-lg p-4">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="text-sm">جودة الحفظ</Label>
                    <span className="text-sm font-bold text-primary">{form.memorization_quality}/50</span>
                  </div>
                  <Slider value={[form.memorization_quality]} onValueChange={([v]) => setForm({ ...form, memorization_quality: v })} max={50} step={1} />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="text-sm">التجويد</Label>
                    <span className="text-sm font-bold text-primary">{form.tajweed_score}/30</span>
                  </div>
                  <Slider value={[form.tajweed_score]} onValueChange={([v]) => setForm({ ...form, tajweed_score: v })} max={30} step={1} />
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <Label className="text-sm">عدد الأخطاء</Label>
                    <span className="text-sm font-bold text-destructive">{form.mistakes_count}</span>
                  </div>
                  <Slider value={[form.mistakes_count]} onValueChange={([v]) => setForm({ ...form, mistakes_count: v })} max={20} step={1} />
                </div>
              </div>

              <div className="text-center py-4 bg-card rounded-xl border">
                <p className="text-sm text-muted-foreground">الدرجة النهائية</p>
                <p className={`text-4xl font-bold ${scoreColor}`}>{totalScore}</p>
                <p className="text-xs text-muted-foreground">من 100</p>
              </div>

              {/* Audio Recording */}
              <div className="space-y-2">
                <Label className="text-xs flex items-center gap-1">
                  <Mic className="w-3 h-3" />
                  تسجيل صوتي
                </Label>
                <AudioRecorder
                  onAudioUrl={setAudioUrl}
                  existingUrl={audioUrl}
                  studentId={currentStudent.id}
                  recordDate={new Date().toISOString().split("T")[0]}
                />
              </div>

              <div className="space-y-1">
                <Label className="text-xs">ملاحظات وتنبيهات</Label>
                <Textarea placeholder="أضف ملاحظاتك هنا..." value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} />
              </div>

              <Button onClick={handleSave} disabled={saving} className="w-full" size="lg">
                <Save className="w-4 h-4 ml-2" />
                {saving ? "جارٍ الحفظ..." : "حفظ التسميع والانتقال للتالي"}
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      {selectedHalaqa && students.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p>لا يوجد طلاب في هذه الحلقة</p>
        </div>
      )}
    </div>
  );
};

export default Recitation;
