// Enrichment material types for the programme library (كتب / يوتيوب / صوتيات / ملفات).
//
// The page only ever accepted a URL — `file_path` was in the table but never written,
// there was no storage bucket, and `program_id` was stripped before insert so every
// material was unfiled. These helpers back real uploads and embedded players.

export type MaterialType = "book" | "video" | "audio" | "file" | "link";

export const MATERIAL_TYPES: MaterialType[] = ["book", "video", "audio", "file", "link"];

export const MATERIAL_LABELS: Record<MaterialType, string> = {
  book: "كتاب",
  video: "فيديو",
  audio: "صوت",
  file: "ملف",
  link: "رابط",
};

/** `accept` attribute for the file input, per type. `link` never takes a file. */
export const MATERIAL_ACCEPT: Record<MaterialType, string> = {
  book: ".pdf,.epub",
  video: "video/*",
  audio: "audio/*",
  file: ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip",
  link: "",
};

/** Upload ceiling per type, in bytes. */
export const MATERIAL_MAX_BYTES: Record<MaterialType, number> = {
  book: 50 * 1024 * 1024,
  video: 200 * 1024 * 1024,
  audio: 50 * 1024 * 1024,
  file: 25 * 1024 * 1024,
  link: 0,
};

const YOUTUBE_HOSTS = ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "www.youtu.be"];

/** Extracts a YouTube video id from watch, youtu.be, embed and shorts URLs. */
export const youtubeVideoId = (url?: string | null): string | null => {
  const raw = String(url ?? "").trim();
  if (!raw) return null;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (!YOUTUBE_HOSTS.includes(parsed.hostname)) return null;

  if (parsed.hostname.endsWith("youtu.be")) {
    const id = parsed.pathname.slice(1).split("/")[0];
    return id || null;
  }
  const v = parsed.searchParams.get("v");
  if (v) return v;

  const parts = parsed.pathname.split("/").filter(Boolean);
  if (parts[0] === "embed" || parts[0] === "shorts" || parts[0] === "live") {
    return parts[1] || null;
  }
  return null;
};

export const isYoutubeUrl = (url?: string | null): boolean => youtubeVideoId(url) !== null;

/** Privacy-preserving embed URL, or null when the link is not YouTube. */
export const youtubeEmbedUrl = (url?: string | null): string | null => {
  const id = youtubeVideoId(url);
  return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
};

/**
 * Storage object key. Supabase storage keys must be URL-safe, and material titles are
 * Arabic, so the display name stays in `title` and only a slug goes in the key.
 */
export const materialStoragePath = (
  programKey: string,
  materialId: string,
  fileName: string,
): string => {
  const dot = fileName.lastIndexOf(".");
  const ext = dot > 0 ? fileName.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, "") : "";
  const base = (dot > 0 ? fileName.slice(0, dot) : fileName)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  const safeProgram = (programKey || "general").replace(/[^a-z0-9-]/gi, "") || "general";
  const name = base || "file";
  return `${safeProgram}/${materialId}/${name}${ext ? `.${ext}` : ""}`;
};

export interface MaterialDraft {
  material_type: MaterialType;
  title?: string;
  url?: string;
  file?: { name: string; size: number } | null;
  /** True when the material already has a stored file from a previous save. */
  hasStoredFile?: boolean;
}

export interface ValidationResult {
  ok: boolean;
  error?: string;
}

/** Validates a material before saving. */
export const validateMaterial = (m: MaterialDraft): ValidationResult => {
  if (!m.title?.trim()) return { ok: false, error: "أدخل عنوان المادة" };

  const hasUrl = !!m.url?.trim();
  const hasFile = !!m.file || !!m.hasStoredFile;

  if (m.material_type === "link" || m.material_type === "video") {
    if (!hasUrl && !hasFile) return { ok: false, error: "أدخل رابط المادة" };
  } else if (!hasUrl && !hasFile) {
    return { ok: false, error: "أدخل رابطاً أو ارفع ملفاً" };
  }

  if (hasUrl) {
    try {
      const u = new URL(m.url!.trim());
      if (u.protocol !== "http:" && u.protocol !== "https:") {
        return { ok: false, error: "الرابط يجب أن يبدأ بـ http أو https" };
      }
    } catch {
      return { ok: false, error: "الرابط غير صالح" };
    }
  }

  if (m.file) {
    const max = MATERIAL_MAX_BYTES[m.material_type];
    if (max > 0 && m.file.size > max) {
      return { ok: false, error: `حجم الملف يتجاوز ${Math.round(max / 1024 / 1024)} ميجابايت` };
    }
  }

  return { ok: true };
};

/** Who an enrichment material is meant for. */
export const MATERIAL_AUDIENCES = ["both", "students", "teachers"] as const;
export type MaterialAudience = (typeof MATERIAL_AUDIENCES)[number];

export const MATERIAL_AUDIENCE_LABELS: Record<MaterialAudience, string> = {
  both: "الطلاب والمعلمون",
  students: "للطلاب",
  teachers: "للمعلمين",
};

/** Normalises any stored value to a known audience. */
export const materialAudience = (raw?: string | null): MaterialAudience =>
  (MATERIAL_AUDIENCES as readonly string[]).includes(raw ?? "")
    ? (raw as MaterialAudience)
    : "both";
