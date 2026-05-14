import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star } from "lucide-react";

const TeacherEvaluationsReport = () => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("teacher_evaluations" as any).select("*");
      if (!data?.length) { setLoading(false); return; }

      const ids = Array.from(new Set(data.map((d: any) => d.teacher_id)));
      const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      const nameMap = new Map((profs || []).map((p: any) => [p.id, p.full_name]));

      const grouped: Record<string, any> = {};
      data.forEach((e: any) => {
        const t = e.teacher_id;
        if (!grouped[t]) grouped[t] = {
          teacher_id: t, name: nameMap.get(t) || "—", count: 0,
          treatment: 0, performance: 0, communication: 0, commitment: 0, development: 0, comments: [] as string[],
        };
        const g = grouped[t];
        g.count++;
        g.treatment += e.rating_treatment;
        g.performance += e.rating_performance;
        g.communication += e.rating_communication;
        g.commitment += e.rating_commitment;
        g.development += e.rating_development;
        if (e.comment) g.comments.push(e.comment);
      });

      const list = Object.values(grouped).map((g: any) => ({
        ...g,
        avg_treatment: (g.treatment / g.count).toFixed(1),
        avg_performance: (g.performance / g.count).toFixed(1),
        avg_communication: (g.communication / g.count).toFixed(1),
        avg_commitment: (g.commitment / g.count).toFixed(1),
        avg_development: (g.development / g.count).toFixed(1),
        avg_overall: ((g.treatment + g.performance + g.communication + g.commitment + g.development) / (g.count * 5)).toFixed(2),
      })).sort((a: any, b: any) => Number(b.avg_overall) - Number(a.avg_overall));

      setRows(list);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-4" dir="rtl">
      <h1 className="text-2xl font-bold">تقرير تقييمات المعلمين</h1>
      <p className="text-sm text-muted-foreground">تقييمات مجمّعة من أولياء الأمور (سرّية)</p>

      {loading ? (
        <p className="text-muted-foreground text-center py-10">جارٍ التحميل...</p>
      ) : rows.length === 0 ? (
        <Card><CardContent className="p-8 text-center">
          <Star className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground">لا توجد تقييمات بعد</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {rows.map((r: any) => (
            <Card key={r.teacher_id}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between text-base">
                  <span>{r.name}</span>
                  <span className="flex items-center gap-1 text-warning">
                    <Star className="w-5 h-5 fill-warning" />
                    <span className="font-bold">{r.avg_overall}</span>
                  </span>
                </CardTitle>
                <p className="text-xs text-muted-foreground">{r.count} تقييم</p>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                <div className="flex justify-between"><span>التعامل</span><span className="font-medium">{r.avg_treatment}</span></div>
                <div className="flex justify-between"><span>الأداء</span><span className="font-medium">{r.avg_performance}</span></div>
                <div className="flex justify-between"><span>التواصل</span><span className="font-medium">{r.avg_communication}</span></div>
                <div className="flex justify-between"><span>الالتزام</span><span className="font-medium">{r.avg_commitment}</span></div>
                <div className="flex justify-between"><span>التطوير</span><span className="font-medium">{r.avg_development}</span></div>
                {r.comments.length > 0 && (
                  <details className="mt-2">
                    <summary className="text-xs text-muted-foreground cursor-pointer">{r.comments.length} ملاحظة</summary>
                    <ul className="mt-2 space-y-1">
                      {r.comments.map((c: string, i: number) => (
                        <li key={i} className="text-xs bg-muted p-2 rounded">{c}</li>
                      ))}
                    </ul>
                  </details>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default TeacherEvaluationsReport;
