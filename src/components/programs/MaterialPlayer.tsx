import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink } from "lucide-react";
import { youtubeEmbedUrl, type MaterialType } from "@/lib/materialType";

interface Props {
  materialType: MaterialType | string;
  url?: string | null;
  filePath?: string | null;
  title: string;
}

/**
 * Plays or opens a material in place: YouTube inline, audio with a player, an uploaded
 * PDF inline, anything else as a link.
 *
 * The bucket is private, so an uploaded file is reached through a short-lived signed
 * URL rather than a public one.
 */
const MaterialPlayer = ({ materialType, url, filePath, title }: Props) => {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [signing, setSigning] = useState(false);

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
        />
      </div>
    );
  }

  if (materialType === "audio" && href) {
    return <audio controls preload="none" src={href} className="w-full" />;
  }

  if (signing) {
    return <p className="text-xs text-muted-foreground">جارٍ تجهيز الملف...</p>;
  }

  if (!href) return null;

  return (
    <div className="flex gap-2">
      <Button asChild variant="outline" size="sm">
        <a href={href} target="_blank" rel="noreferrer">
          {signedUrl ? <Download className="w-3 h-3 ml-1" /> : <ExternalLink className="w-3 h-3 ml-1" />}
          {signedUrl ? "تحميل" : "فتح"}
        </a>
      </Button>
    </div>
  );
};

export default MaterialPlayer;
