import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, GraduationCap, Library, ScrollText, Sun, Trophy, TrendingUp } from "lucide-react";
import type { ProgramDef } from "@/lib/programs";

const ICONS: Record<string, typeof Trophy> = {
  Trophy,
  BookOpen,
  ScrollText,
  Sun,
  GraduationCap,
};

export interface ProgramMetric {
  value: string | number;
  label: string;
}

interface Props {
  program: ProgramDef;
  metrics: ProgramMetric[];
  /** Single line under the metrics, e.g. a pass rate or the last session date. */
  footnote?: string;
  supervisorName?: string | null;
}

/**
 * One programme on the supervision screen. Replaces three near-identical blocks that
 * had to be copy-pasted for every new programme — which is why summer and talqeen
 * were never added.
 */
const ProgramCard = ({ program, metrics, footnote, supervisorName }: Props) => {
  const navigate = useNavigate();
  const Icon = ICONS[program.icon] ?? BookOpen;

  return (
    <Card className={program.border}>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Icon className={`w-5 h-5 ${program.accent}`} />
          {program.label}
        </CardTitle>
        <p className="text-xs text-muted-foreground">{program.description}</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className={`grid gap-3 ${metrics.length > 2 ? "grid-cols-3" : "grid-cols-2"}`}>
          {metrics.map((m) => (
            <div key={m.label} className="bg-background rounded-lg p-3 text-center">
              <p className={`text-2xl font-bold ${program.accent}`}>{m.value}</p>
              <p className="text-xs text-muted-foreground">{m.label}</p>
            </div>
          ))}
        </div>

        {footnote && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <TrendingUp className="w-3 h-3" />
            {footnote}
          </div>
        )}

        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="font-medium">المشرف:</span>
          <span>{supervisorName || "غير مُسنَد"}</span>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="flex-1" onClick={() => navigate(program.route)}>
            عرض التفاصيل
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/program-materials?program=${program.key}`)}
            title="مواد البرنامج"
          >
            <Library className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProgramCard;
