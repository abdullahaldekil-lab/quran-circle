import { useEffect, useState } from "react";
import StudentNameLink from "@/components/StudentNameLink";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import GuardianLayout from "@/components/GuardianLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { User, BookOpen, ChevronLeft, Clock, Plus } from "lucide-react";
import { memorizedPercent } from "@/lib/memorization";

const GuardianDashboard = () => {
  const navigate = useNavigate();
  const [guardian, setGuardian] = useState<any>(null);
  const [children, setChildren] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/guardian-auth"); return; }

      // Verify this is a guardian
      const { data: gProfile } = await supabase
        .from("guardian_profiles")
        .select("*")
        .eq("id", session.user.id)
        .maybeSingle();

      if (!gProfile) { navigate("/guardian-auth"); return; }
      setGuardian(gProfile);

      // Get linked students
      const { data: links } = await supabase
        .from("guardian_students")
        .select("student_id")
        .eq("guardian_id", session.user.id);

      if (links && links.length > 0) {
        const studentIds = links.map((l: any) => l.student_id);
        const { data: students } = await supabase
          .from("students")
          .select("*, halaqat(name)")
          .in("id", studentIds);
        setChildren(students || []);
      }
      setLoading(false);
    };
    fetchData();
  }, [navigate]);

  if (loading) {
    return (
      <GuardianLayout>
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </GuardianLayout>
    );
  }

  const isPending = guardian?.approval_status === "pending";
  const isRejected = guardian?.approval_status === "rejected";

  return (
    <GuardianLayout guardianName={guardian?.full_name}>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-xl font-bold text-foreground">أهلاً {guardian?.full_name}</h1>
          <p className="text-sm text-muted-foreground mt-1">تابع تقدم أبنائك في حفظ القرآن الكريم</p>
        </div>

        {isPending && (
          <Card className="border-amber-500/40 bg-amber-50 dark:bg-amber-950/20">
            <CardContent className="p-4 flex items-start gap-3">
              <Clock className="w-5 h-5 text-amber-600 mt-0.5" />
              <div>
                <p className="font-semibold text-sm">حسابك قيد المراجعة</p>
                <p className="text-xs text-muted-foreground mt-1">
                  سيتم تفعيل حسابك بعد اعتماد المشرف أو السكرتير. لن تظهر بيانات الأبناء قبل الاعتماد.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {isRejected && (
          <Card className="border-destructive/40 bg-destructive/10">
            <CardContent className="p-4">
              <p className="font-semibold text-sm text-destructive">تم رفض الحساب</p>
              <p className="text-xs text-muted-foreground mt-1">يرجى التواصل مع إدارة المجمع.</p>
            </CardContent>
          </Card>
        )}

        {!isPending && !isRejected && (
          <Button onClick={() => navigate("/guardian/link-request")} className="w-full" variant="outline">
            <Plus className="w-4 h-4 ml-2" />
            إضافة ابن برقم الهوية
          </Button>
        )}

        {!isPending && !isRejected && (children.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <User className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">لم يتم ربط أي طالب بحسابك بعد</p>
              <p className="text-xs text-muted-foreground mt-1">استخدم زر "إضافة ابن" أعلاه لإرسال طلب الربط</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {children.map((child) => {
              const progress = memorizedPercent(child.total_memorized_pages);
              return (
                <Card key={child.id} className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => navigate(`/guardian/child/${child.id}`)}>
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                        <User className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-foreground truncate"><StudentNameLink studentId={child.id} studentName={child.full_name} /></h3>
                          <ChevronLeft className="w-5 h-5 text-muted-foreground shrink-0" />
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="text-xs">{child.current_level}</Badge>
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <BookOpen className="w-3 h-3" />
                            {child.halaqat?.name || "—"}
                          </span>
                        </div>
                        <div className="mt-2 space-y-1">
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>تقدم الحفظ</span>
                            <span>{progress}%</span>
                          </div>
                          <Progress value={progress} className="h-2" />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ))}
      </div>
    </GuardianLayout>
  );
};

export default GuardianDashboard;
