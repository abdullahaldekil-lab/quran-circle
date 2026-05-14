import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, FileType, Headphones, Video as VideoIcon } from "lucide-react";

export type LessonType = "manual" | "pdf" | "audio" | "video";

export interface ContentViewerLesson {
  id: string;
  title: string;
  lesson_type: LessonType | string;
  content?: string | null;
  pdf_url?: string | null;
  audio_url?: string | null;
  video_url?: string | null;
  notes?: string | null;
}

const toYouTubeEmbed = (url: string): string => {
  if (!url) return url;
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) {
      const id = u.pathname.replace("/", "");
      return `https://www.youtube.com/embed/${id}`;
    }
    if (u.hostname.includes("youtube.com")) {
      if (u.pathname.startsWith("/embed/")) return url;
      const id = u.searchParams.get("v");
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    return url;
  } catch {
    return url;
  }
};

export const lessonTypeIcon = (t: string) => {
  switch (t) {
    case "pdf":
      return <FileType className="w-4 h-4 text-red-600" />;
    case "audio":
      return <Headphones className="w-4 h-4 text-emerald-600" />;
    case "video":
      return <VideoIcon className="w-4 h-4 text-blue-600" />;
    default:
      return <FileText className="w-4 h-4 text-muted-foreground" />;
  }
};

export const lessonTypeLabel = (t: string) =>
  t === "pdf" ? "ملف PDF" : t === "audio" ? "صوت" : t === "video" ? "فيديو" : "نص";

interface Props {
  lesson: ContentViewerLesson | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

const ContentViewer = ({ lesson, open, onOpenChange }: Props) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl w-[95vw] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {lesson && lessonTypeIcon(lesson.lesson_type)}
            {lesson?.title || "عرض الدرس"}
          </DialogTitle>
        </DialogHeader>

        {!lesson ? (
          <p className="text-center text-muted-foreground py-8">لا يوجد درس محدد</p>
        ) : lesson.lesson_type === "manual" ? (
          <div className="prose prose-sm max-w-none whitespace-pre-wrap leading-7 text-foreground">
            {lesson.content || "لا يوجد محتوى نصي."}
          </div>
        ) : lesson.lesson_type === "pdf" && lesson.pdf_url ? (
          <iframe
            src={`${lesson.pdf_url}#toolbar=0`}
            className="w-full h-[70vh] rounded border"
            sandbox="allow-same-origin allow-scripts"
            title={lesson.title}
          />
        ) : lesson.lesson_type === "audio" && lesson.audio_url ? (
          <div className="flex justify-center py-8">
            <audio controls controlsList="nodownload" src={lesson.audio_url} className="w-full max-w-2xl" />
          </div>
        ) : lesson.lesson_type === "video" && lesson.video_url ? (
          <iframe
            src={toYouTubeEmbed(lesson.video_url)}
            className="w-full aspect-video rounded border"
            allowFullScreen
            sandbox="allow-same-origin allow-scripts allow-presentation"
            title={lesson.title}
          />
        ) : (
          <p className="text-center text-muted-foreground py-8">لا يوجد محتوى لهذا الدرس بعد.</p>
        )}

        {lesson?.notes && (
          <div className="mt-4 p-3 rounded-lg bg-muted/40 text-sm">
            <span className="font-semibold">ملاحظات: </span>{lesson.notes}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ContentViewer;
