import { useEffect, useState } from "react";
import { formatDateHijriOnly } from "@/lib/hijri";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import GuardianLayout from "@/components/GuardianLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Star } from "lucide-react";

const CRITERIA = [
  { key: "rating_treatment", label: "تعامله مع الطالب" },
  { key: "rating_performance", label: "أداؤه التعليمي" },
  { key: "rating_communication", label: "تواصله مع ولي الأمر" },
  { key: "rating_commitment", label: "الالتزام والانضباط" },
  { key: "rating_development", label: "تطوير مستوى الطالب" },
] as const;

const GuardianEvaluation = () => {
  const navigate = useNavigate();
  const [guardian, setGuardian] = useState<any>(null);
  const [children, setChildren] = useState<any[]>([]);
  const [studentId, setStudentId] = useState("");
  const [teacherId, setTeacherId] = useState<string | null>(null);
  const [teacherName, setTeacherName] = useState<string>("");
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/guardian-auth"); return; }
      const { data: gp } = await supabase.from("guardian_profiles").select("*").eq("id", session.user.id).maybeSingle();
      if (!gp) { navigate("/guardian-auth"); return; }
      setGuardian(gp);

      const { data: links } = await supabase.from("guardian_students").select("student_id").eq("guardian_id", session.user.id);
      if (links?.length) {
        const ids = links.map(l => l.student_id);
        const { data: kids } = await supabase.from("students").select("id, full_name, halaqa_id").in("id", ids);
        setChildren(kids || []);
        if (kids?.length === 1) setStudentId(kids[0].id);
      }

      const { data: hist } = await supabase
        .from("teacher_evaluations" as any)
        .select("*")
        .eq("guardian_id", session.user.id)
        .order("created_at", { ascending: false });
      setHistory(hist || []);
    })();
  }, [navigate]);

  // Load teacher when student selected
  useEffect(() => {
    if (!studentId) { setTeacherId(null); setTeacherName(""); return; }
    (async () => {
      const child = children.find(c => c.id === studentId);
      if (!child?.halaqa_id) return;
      const { data: h } = await supabase.from("halaqat").select("teacher_id").eq("id", child.halaqa_id).maybeSingle();
      if (h?.teacher_id) {
        setTeacherId(h.teacher_id);
        const { data: p } = await supabase.from("profiles").select("full_name").eq("id", h.teacher_id).maybeSingle();
        setTeacherName(p?.full_name || "");
      }
    })();
  }, [studentId, children]);

  const submit = async () => {
    if (!teacherId) { toast.error("لا يوجد معلم محدد لهذا الطالب"); return; }
    if (CRITERIA.some(c => !ratings[c.key])) { toast.error("الرجاء تقييم جميع المحاور"); return; }
    setSaving(true);
    const payload: any = {
      guardian_id: guardian.id, teacher_id: teacherId, student_id: studentId, comment: comment || null,
    };
    CRITERIA.forEach(c => { payload[c.key] = ratings[c.key]; });
    const { error } = await supabase.from("teacher_evaluations" as any).insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("شكراً لتقييمك");
    setRatings({}); setComment("");
    const { data: hist } = await supabase
      .from("teacher_evaluations" as any).select("*")
      .eq("guardian_id", guardian.id).order("created_at", { ascending: false });
    setHistory(hist || []);
  };

  return (
    <GuardianLayout guardianName={guardian?.full_name}>
      <div className="space-y-4 animate-fade-in">
        <h1 className="text-xl font-bold">تقييم المعلم</h1>

        <Card>
          <CardHeader><CardTitle className="text-base">تقييم جديد</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>الطالب</Label>
              <Select value={studentId} onValueChange={setStudentId}>
                <SelectTrigger><SelectValue placeholder="اختر الطالب" /></SelectTrigger>
                <SelectContent>
                  {children.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {teacherName && (
              <p className="text-sm text-muted-foreground">المعلم: <span className="font-medium text-foreground">{teacherName}</span></p>
            )}

            {CRITERIA.map(c => (
              <div key={c.key}>
                <Label className="text-sm">{c.label}</Label>
                <div className="flex gap-1 mt-1">
                  {[1,2,3,4,5].map(v => (
                    <button
                      key={v} type="button"
                      onClick={() => setRatings(r => ({ ...r, [c.key]: v }))}
                      className="p-1"
                    >
                      <Star className={`w-7 h-7 ${(ratings[c.key] || 0) >= v ? "fill-warning text-warning" : "text-muted-foreground"}`} />
                    </button>
                  ))}
                </div>
              </div>
            ))}

            <div>
              <Label>ملاحظة (اختياري)</Label>
              <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={3} />
            </div>
            <Button onClick={submit} disabled={saving || !teacherId} className="w-full">
              {saving ? "جارٍ الإرسال..." : "إرسال التقييم"}
            </Button>
          </CardContent>
        </Card>

        {history.length > 0 && (
          <Card>
            <CardHeader><CardTitle className="text-base">تقييماتك السابقة</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {history.map((h: any) => {
                const avg = (h.rating_treatment + h.rating_performance + h.rating_communication + h.rating_commitment + h.rating_development) / 5;
                return (
                  <div key={h.id} className="flex justify-between items-center py-2 border-b last:border-0">
                    <div>
                      <p className="text-sm font-medium">{h.term}</p>
                      <p className="text-xs text-muted-foreground">{formatDateHijriOnly(h.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 fill-warning text-warning" />
                      <span className="text-sm font-bold">{avg.toFixed(1)}</span>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>
    </GuardianLayout>
  );
};

export default GuardianEvaluation;
