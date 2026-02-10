import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Mic, Square, Play, Pause, Trash2, Upload } from "lucide-react";

interface AudioRecorderProps {
  onAudioUrl: (url: string) => void;
  existingUrl?: string | null;
  studentId: string;
  recordDate: string;
}

const AudioRecorder = ({ onAudioUrl, existingUrl, studentId, recordDate }: AudioRecorderProps) => {
  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(existingUrl || null);
  const [playing, setPlaying] = useState(false);
  const [uploading, setUploading] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    setAudioUrl(existingUrl || null);
    setAudioBlob(null);
  }, [existingUrl]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setRecording(true);
    } catch {
      toast.error("لا يمكن الوصول إلى الميكروفون");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const togglePlay = () => {
    if (!audioRef.current || !audioUrl) return;
    if (playing) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setPlaying(!playing);
  };

  const uploadAudio = async () => {
    if (!audioBlob) return;
    setUploading(true);
    const fileName = `${studentId}/${recordDate}-${Date.now()}.webm`;
    const { error } = await supabase.storage
      .from("recitation-audio")
      .upload(fileName, audioBlob, { contentType: "audio/webm" });

    if (error) {
      toast.error("فشل رفع التسجيل");
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from("recitation-audio")
      .getPublicUrl(fileName);

    onAudioUrl(urlData.publicUrl);
    setAudioBlob(null);
    toast.success("تم رفع التسجيل بنجاح");
    setUploading(false);
  };

  const deleteRecording = () => {
    setAudioBlob(null);
    setAudioUrl(null);
    onAudioUrl("");
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        {!recording ? (
          <Button type="button" variant="outline" size="sm" onClick={startRecording}>
            <Mic className="w-4 h-4 ml-1" />
            تسجيل
          </Button>
        ) : (
          <Button type="button" variant="destructive" size="sm" onClick={stopRecording}>
            <Square className="w-4 h-4 ml-1" />
            إيقاف
          </Button>
        )}

        {audioUrl && (
          <>
            <Button type="button" variant="ghost" size="sm" onClick={togglePlay}>
              {playing ? <Pause className="w-4 h-4 ml-1" /> : <Play className="w-4 h-4 ml-1" />}
              {playing ? "إيقاف" : "تشغيل"}
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={deleteRecording}>
              <Trash2 className="w-4 h-4 ml-1" />
              حذف
            </Button>
          </>
        )}

        {audioBlob && (
          <Button type="button" size="sm" onClick={uploadAudio} disabled={uploading}>
            <Upload className="w-4 h-4 ml-1" />
            {uploading ? "جارٍ الرفع..." : "رفع"}
          </Button>
        )}
      </div>

      {recording && (
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-destructive animate-pulse" />
          <span className="text-sm text-destructive font-medium">جارٍ التسجيل...</span>
        </div>
      )}

      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onEnded={() => setPlaying(false)}
          className="hidden"
        />
      )}
    </div>
  );
};

export default AudioRecorder;
