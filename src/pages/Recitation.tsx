import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTeacherHalaqat } from "@/hooks/useTeacherHalaqat";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { Save, ChevronLeft, ChevronRight, ClipboardList, Mic, History, ChevronDown, ChevronUp } from "lucide-react";
import AudioRecorder from "@/components/AudioRecorder";
import { sendNotification } from "@/utils/sendNotification";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import StudentNameLink from "@/components/StudentNameLink";

const Recitation = () => {
  const { user } = useAuth();
  const { filterHalaqat, loading: accessLoading } = useTeacherHalaqat();
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

  // Load halaqat and auto-select teacher's halaqa
  useEffect(() => {
    if (!user || accessLoading) return;
    supabase.from("halaqat").select("*").eq("active", true).then(({ data }) => {
      const list = filterHalaqat(data || []);
      setHalaqat(list);
      const myHalaqa = list.find(
        (h) => h.teacher_id === user.id || h.assistant_teacher_id === user.id
      );
      if (myHalaqa && !selectedHalaqa) {
        setSelectedHalaqa(myHalaqa.id);
      }
    });
  }, [user, accessLoading]);

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
    if (error) {
      setSaving(false);
      toast.error("حدث خطأ أثناء الحفظ");
      return;
    }

    // Auto-progress: advance student level if score >= 80
    if (totalScore >= 80) {
      await advanceStudentLevel(currentStudent.id);
    }

    // Send notification to guardians about new recitation
    const { data: guardianLinks } = await supabase.from("guardian_students").select("guardian_id").eq("student_id", currentStudent.id).eq("active", true);
    if (guardianLinks && guardianLinks.length > 0) {
      sendNotification({
        templateCode: "NEW_RECITATION",
        recipientIds: guardianLinks.map((l: any) => l.guardian_id),
        variables: { studentName: currentStudent.full_name, score: String(totalScore) },
      }).catch(console.error);
    }

    setSaving(false);
    toast.success(`تم حفظ تسميع ${currentStudent.full_name} - الدرجة: ${totalScore}`);
    if (currentIndex < students.length - 1) {
      setCurrentIndex(currentIndex + 1);
      resetForm();
    }
  };

  /** Advance student to next part/branch/level automatically */
  const advanceStudentLevel = async (studentId: string) => {
    try {
      const { data: sl } = await supabase.from("student_levels").select("*").eq("student_id", studentId).maybeSingle();
      if (!sl) return;

      const { data: allBranches } = await supabase.from("level_branches").select("*").eq("level_track_id", sl.level_track_id).order("sort_order");
      const { data: allParts } = await supabase.from("level_parts").select("*").eq("branch_id", sl.branch_id).order("sort_order");
      const { data: allTracks } = await supabase.from("level_tracks").select("*").eq("active", true).order("sort_order");

      if (!allBranches || !allParts || !allTracks) return;

      const currentPartIndex = allParts.findIndex(p => p.part_number === sl.part_number);
      
      if (currentPartIndex < allParts.length - 1) {
        // Next part in same branch
        await supabase.from("student_levels").update({
          part_number: allParts[currentPartIndex + 1].part_number,
          updated_by_manager: false,
        }).eq("id", sl.id);
        toast.info("تم الانتقال للجزء التالي تلقائياً");
      } else {
        // Completed all parts in branch, move to next branch
        const currentBranchIndex = allBranches.findIndex(b => b.id === sl.branch_id);
        if (currentBranchIndex < allBranches.length - 1) {
          const nextBranch = allBranches[currentBranchIndex + 1];
          await supabase.from("student_levels").update({
            branch_id: nextBranch.id,
            part_number: 1,
            updated_by_manager: false,
          }).eq("id", sl.id);
          toast.info(`تم الانتقال للفرع ${nextBranch.branch_number} تلقائياً`);
        } else {
          // Completed all branches in level, move to next level
          const currentTrackIndex = allTracks.findIndex(t => t.id === sl.level_track_id);
          if (currentTrackIndex < allTracks.length - 1) {
            const nextTrack = allTracks[currentTrackIndex + 1];
            const { data: nextBranches } = await supabase.from("level_branches").select("*").eq("level_track_id", nextTrack.id).order("sort_order").limit(1);
            await supabase.from("student_levels").update({
              level_track_id: nextTrack.id,
              branch_id: nextBranches?.[0]?.id || null,
              part_number: 1,
              updated_by_manager: false,
              completion_date: null,
            }).eq("id", sl.id);
            toast.success(`🎉 تم الانتقال لمستوى ${nextTrack.name}`);
          } else {
            // All levels completed - graduate
            await supabase.from("student_levels").update({
              completion_date: new Date().toISOString().split("T")[0],
              progress_percentage: 100,
            }).eq("id", sl.id);
            toast.success("🎓 أتم الطالب جميع المستويات - الخريجين!");
          }
        }
      }
    } catch (err) {
      console.error("Auto-progress error:", err);
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
                  <h2 className="text-lg font-bold"><StudentNameLink studentId={currentStudent.id} studentName={currentStudent.full_name} /></h2>
                  <p className="text-sm text-muted-foreground">{currentIndex + 1} من {students.length}</p>
                </div>
                <Button variant="ghost" size="icon" disabled={currentIndex <= 0} onClick={() => { setCurrentIndex(currentIndex - 1); resetForm(); }}>
                  <ChevronLeft className="w-5 h-5" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Student Recitation History */}
          <StudentHistory studentId={currentStudent.id} />

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

/** Collapsible history of past recitations for a student (lazy-loaded) */
const StudentHistory = ({ studentId }: { studentId: string }) => {
  const [open, setOpen] = useState(false);
  const [records, setRecords] = useState<any[]>([]);
  const [loaded, setLoaded] = useState(false);

  // Reset when student changes
  useEffect(() => {
    setOpen(false);
    setRecords([]);
    setLoaded(false);
  }, [studentId]);

  // Lazy-load only when opened
  useEffect(() => {
    if (!open || loaded) return;
    supabase
      .from("recitation_records")
      .select("id, record_date, memorized_from, memorized_to, review_from, review_to, total_score, mistakes_count, notes")
      .eq("student_id", studentId)
      .order("record_date", { ascending: false })
      .limit(10)
      .then(({ data }) => {
        setRecords(data || []);
        setLoaded(true);
      });
  }, [open, loaded, studentId]);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors rounded-t-lg">
            <CardTitle className="text-base flex items-center justify-between">
              <span className="flex items-center gap-2">
                <History className="w-5 h-5 text-primary" />
                السجل السابق
              </span>
              {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0">
            {!loaded ? (
              <div className="flex justify-center py-4">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : records.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">لا توجد تسميعات سابقة</p>
            ) : (
              <div className="space-y-2">
                {records.map((r) => {
                  const score = Number(r.total_score);
                  const sc = score >= 80 ? "text-success" : score >= 60 ? "text-warning" : "text-destructive";
                  return (
                    <div key={r.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30 border text-sm">
                      <div className="space-y-0.5">
                        <p className="font-medium">{r.record_date}</p>
                        <p className="text-xs text-muted-foreground">
                          {r.memorized_from && r.memorized_to
                            ? `حفظ: ${r.memorized_from} → ${r.memorized_to}`
                            : r.review_from && r.review_to
                            ? `مراجعة: ${r.review_from} → ${r.review_to}`
                            : "—"}
                        </p>
                        {r.notes && <p className="text-xs text-muted-foreground line-clamp-1">{r.notes}</p>}
                      </div>
                      <div className="text-left">
                        <p className={`text-lg font-bold ${sc}`}>{r.total_score ?? "—"}</p>
                        {r.mistakes_count != null && (
                          <p className="text-xs text-muted-foreground">{r.mistakes_count} أخطاء</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};

export default Recitation;
