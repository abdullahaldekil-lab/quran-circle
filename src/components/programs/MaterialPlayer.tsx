import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink } from "lucide-react";
import { youtubeEmbedUrl, type MaterialType } from "@/lib/materialType";
import { completionPercent, isCompleted, logMaterialView } from "@/lib/materialViews";

interface Props {
  materialType: MaterialType | string;
  url?: string | null;
  filePath?: string | null;
  title: string;
  /** Material id — enables view tracking. */
  materialId?: string;
  /** Viewer identity when known (student portal). */
  studentId?: string | null;
  studentCode?: string | null;
}

/**
 * Plays or opens a material in place: YouTube inline, audio with a player, an uploaded
 * PDF inline, anything else as a link.
 *
 * The bucket is private, so an uploaded file is reached through a short-lived signed
 * URL rather than a public one.
 *
 * Every play / download / open is logged to `program_material_views` so management can
 * see which materials are actually used.
 */
const MaterialPlayer = ({ materialType, url, filePath, title, materialId, studentId, studentCode }: Props) => {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const completedRef = useRef(false);
  const [viewerId, setViewerId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setViewerId(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!filePath) {
      setSignedUrl(null);
      return;
    }
    setSigning(true);
    supabase.storage
      .from("program-materials")
      .createSignedUrl(filePath, 3600)
      .then(({ data }) => {
        if (!cancelled) {
          setSignedUrl(data?.signedUrl ?? null);
          setSigning(false);
        }
      });
    return () => { cancelled = true; };
  }, [filePath]);

  const track = (
    event_type: "open" | "play" | "download" | "complete",
    seconds = 0,
    percent = 0,
  ) => {
    if (!materialId) return;
    void logMaterialView({
      material_id: materialId,
      event_type,
      student_id: studentId ?? null,
      student_code: studentCode ?? null,
      user_id: viewerId,
      seconds_watched: seconds,
      completion_percent: percent,
    });
  };

  const embed = youtubeEmbedUrl(url);
  const href = signedUrl || url || null;

  if (embed) {
    return (
      <div className="aspect-video w-full overflow-hidden rounded-lg border">
        <iframe
          src={embed}
          title={title}
          className="w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          // A cross-origin iframe gives no playback events, so the click-through counts as a play.
          onLoad={() => track("open")}
        />
      </div>
    );
  }

  if (materialType === "audio" && href) {
    return (
      <audio
        ref={audioRef}
        controls
        preload="none"
        src={href}
        className="w-full"
        onPlay={() => track("play")}
        onTimeUpdate={() => {
          const el = audioRef.current;
          if (!el || completedRef.current) return;
          const pct = completionPercent(el.currentTime, el.duration);
          if (isCompleted(pct)) {
            completedRef.current = true;
            track("complete", el.currentTime, pct);
          }
        }}
        onEnded={() => {
          const el = audioRef.current;
          if (completedRef.current) return;
          completedRef.current = true;
          track("complete", el?.duration ?? 0, 100);
        }}
      />
    );
  }

  if (signing) {
    return <p className="text-xs text-muted-foreground">جارٍ تجهيز الملف...</p>;
  }

  if (!href) return null;

  return (
    <div className="flex gap-2">
      <Button asChild variant="outline" size="sm">
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          onClick={() => track(signedUrl ? "download" : "open")}
        >
          {signedUrl ? <Download className="w-3 h-3 ml-1" /> : <ExternalLink className="w-3 h-3 ml-1" />}
          {signedUrl ? "تحميل" : "فتح"}
        </a>
      </Button>
    </div>
  );
};

export default MaterialPlayer;
