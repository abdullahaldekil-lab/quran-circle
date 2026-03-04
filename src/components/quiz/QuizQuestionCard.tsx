import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Check, X } from "lucide-react";

interface QuizQuestion {
  question_number: number;
  question_type: string;
  question_text: string;
  expected_answer: string;
  is_correct?: boolean | null;
  teacher_note?: string;
}

interface Props {
  question: QuizQuestion;
  index: number;
  readOnly: boolean;
  onGrade: (index: number, isCorrect: boolean) => void;
  onNoteChange: (index: number, note: string) => void;
}

const TYPE_LABELS: Record<string, string> = {
  complete_verse: "أكمل الآية",
  next_verse: "ما الآية التالية",
  which_surah: "في أي سورة",
  verse_count: "عدد الآيات",
  surah_contains: "السورة التي تحتوي",
};

const QuizQuestionCard = ({ question, index, readOnly, onGrade, onNoteChange }: Props) => {
  const graded = question.is_correct !== null && question.is_correct !== undefined;

  return (
    <Card className={`transition-all ${graded ? (question.is_correct ? "border-green-500/50 bg-green-50/30 dark:bg-green-950/10" : "border-red-500/50 bg-red-50/30 dark:bg-red-950/10") : ""}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary text-sm font-bold">
              {question.question_number}
            </span>
            <Badge variant="outline" className="text-xs">
              {TYPE_LABELS[question.question_type] || question.question_type}
            </Badge>
          </div>
          {graded && (
            <Badge variant={question.is_correct ? "default" : "destructive"} className="text-xs">
              {question.is_correct ? "✅ صحيح" : "❌ خطأ"}
            </Badge>
          )}
        </div>

        <p className="text-sm font-medium leading-relaxed">{question.question_text}</p>

        <div className="bg-muted/50 rounded-lg p-3">
          <p className="text-xs text-muted-foreground mb-1">الإجابة المتوقعة:</p>
          <p className="text-sm">{question.expected_answer}</p>
        </div>

        {!readOnly && (
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={question.is_correct === true ? "default" : "outline"}
              className={question.is_correct === true ? "bg-green-600 hover:bg-green-700" : ""}
              onClick={() => onGrade(index, true)}
            >
              <Check className="w-4 h-4 ml-1" /> صحيح
            </Button>
            <Button
              size="sm"
              variant={question.is_correct === false ? "destructive" : "outline"}
              onClick={() => onGrade(index, false)}
            >
              <X className="w-4 h-4 ml-1" /> خطأ
            </Button>
          </div>
        )}

        <Textarea
          placeholder="ملاحظة اختيارية..."
          value={question.teacher_note || ""}
          onChange={(e) => onNoteChange(index, e.target.value)}
          disabled={readOnly}
          className="text-sm min-h-[60px]"
        />
      </CardContent>
    </Card>
  );
};

export default QuizQuestionCard;
