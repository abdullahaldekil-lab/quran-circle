import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GraduationCap, BookOpen, Target, RefreshCw } from "lucide-react";

const Levels = () => {
  const [levels, setLevels] = useState<any[]>([]);

  useEffect(() => {
    supabase
      .from("memorization_levels")
      .select("*")
      .eq("active", true)
      .order("sort_order")
      .then(({ data }) => setLevels(data || []));
  }, []);

  const levelColors = [
    "bg-emerald-500/10 text-emerald-700 border-emerald-200",
    "bg-blue-500/10 text-blue-700 border-blue-200",
    "bg-amber-500/10 text-amber-700 border-amber-200",
    "bg-purple-500/10 text-purple-700 border-purple-200",
    "bg-rose-500/10 text-rose-700 border-rose-200",
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold">مستويات الحفظ</h1>
        <p className="text-muted-foreground text-sm">المستويات المعتمدة لتنظيم الطلاب وتحديد أهداف الحفظ اليومية</p>
      </div>

      <div className="grid gap-4">
        {levels.map((level, i) => (
          <Card key={level.id} className="overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-primary" />
                  {level.name}
                </CardTitle>
                <Badge variant="outline" className={levelColors[i % levelColors.length]}>
                  المستوى {level.sort_order}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">{level.description}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-start gap-2 bg-muted/50 rounded-lg p-3">
                  <Target className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">نطاق الحفظ</p>
                    <p className="text-sm font-medium">{level.target_memorization}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 bg-muted/50 rounded-lg p-3">
                  <BookOpen className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">الحفظ اليومي</p>
                    <p className="text-sm font-medium">{level.daily_target}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 bg-muted/50 rounded-lg p-3">
                  <RefreshCw className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">المراجعة</p>
                    <p className="text-sm font-medium">{level.review_requirement}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2 bg-muted/50 rounded-lg p-3">
                  <GraduationCap className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">مناسب لـ</p>
                    <p className="text-sm font-medium">{level.suitable_for}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default Levels;
