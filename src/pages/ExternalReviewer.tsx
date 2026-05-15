import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export default function ExternalReviewer() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  const [step, setStep] = useState<'info' | 'form' | 'done'>('info');
  const [tokenData, setTokenData] = useState<any>(null);
  const [reviewerName, setReviewerName] = useState('');
  const [reviewerPhone, setReviewerPhone] = useState('');
  const [scores, setScores] = useState({ mistakes: 0, lahn: 0, warnings: 0, score: 0 });

  useEffect(() => {
    if (!token) return;
    (supabase as any)
      .from('narration_external_tokens')
      .select('*, narration_sessions(id, session_date)')
      .eq('token', token)
      .maybeSingle()
      .then(({ data }: { data: any }) => {
        if (!data || new Date(data.expires_at) < new Date()) {
          setStep('done');
        } else {
          setTokenData(data);
        }
      });
  }, [token]);

  const handleSubmitInfo = () => {
    if (!reviewerName.trim() || !reviewerPhone.trim()) {
      toast({ title: 'يرجى إدخال الاسم والجوال', variant: 'destructive' });
      return;
    }
    setStep('form');
  };

  const handleSave = async () => {
    const { error } = await (supabase as any)
      .from('narration_external_tokens')
      .update({
        reviewer_name: reviewerName,
        reviewer_phone: reviewerPhone,
        used_at: new Date().toISOString(),
      })
      .eq('token', token);

    if (error) {
      toast({ title: 'فشل حفظ التقييم', variant: 'destructive' });
      return;
    }

    setStep('done');
    toast({ title: '✅ تم حفظ التقييم بنجاح' });
  };

  if (step === 'done') {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 text-center" dir="rtl">
        <div>
          <p className="text-2xl font-bold text-green-700 mb-2">✅ شكراً لك</p>
          <p className="text-muted-foreground">
            تم حفظ تقييمك بنجاح أو انتهت صلاحية الرابط
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6 max-w-lg mx-auto" dir="rtl">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-primary">مجمع حويلان</h1>
        <p className="text-muted-foreground text-sm">
          نموذج تقييم المسمع الخارجي
        </p>
        {tokenData?.narration_sessions?.session_date && (
          <p className="text-xs text-muted-foreground mt-1">
            تاريخ الجلسة: {new Date(tokenData.narration_sessions.session_date).toLocaleDateString('ar-SA')}
          </p>
        )}
      </div>

      {step === 'info' ? (
        <Card>
          <CardContent className="p-6 space-y-4">
            <h2 className="font-semibold text-foreground">بيانات المسمع</h2>
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">الاسم الكامل</label>
              <Input
                placeholder="الاسم الكامل"
                value={reviewerName}
                onChange={(e) => setReviewerName(e.target.value)}
                className="text-right"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-muted-foreground">رقم الجوال</label>
              <Input
                placeholder="رقم الجوال"
                type="tel"
                value={reviewerPhone}
                onChange={(e) => setReviewerPhone(e.target.value)}
                className="text-right"
              />
            </div>
            <Button className="w-full" onClick={handleSubmitInfo}>
              متابعة
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6 space-y-5">
            <h2 className="font-semibold text-foreground">نموذج التقييم</h2>

            {(['mistakes', 'lahn', 'warnings'] as const).map((key) => (
              <div key={key} className="flex items-center justify-between">
                <label className="text-sm text-foreground">
                  {key === 'mistakes' ? 'الأخطاء' : key === 'lahn' ? 'اللحن' : 'التنبيهات'}
                </label>
                <div className="flex items-center gap-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setScores((s) => ({ ...s, [key]: Math.max(0, s[key] - 1) }))
                    }
                  >
                    −
                  </Button>
                  <span className="w-8 text-center font-bold text-foreground">
                    {scores[key]}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setScores((s) => ({ ...s, [key]: s[key] + 1 }))
                    }
                  >
                    +
                  </Button>
                </div>
              </div>
            ))}

            <div className="space-y-1.5">
              <label className="text-sm text-foreground">الدرجة الكلية (من 100)</label>
              <Input
                type="number"
                min={0}
                max={100}
                value={scores.score}
                onChange={(e) =>
                  setScores((s) => ({ ...s, score: +e.target.value }))
                }
                className="text-right"
              />
            </div>

            <Button className="w-full" onClick={handleSave}>
              حفظ التقييم
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
