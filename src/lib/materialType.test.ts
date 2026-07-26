import { describe, it, expect } from "vitest";
import {
  MATERIAL_LABELS,
  MATERIAL_TYPES,
  isYoutubeUrl,
  materialStoragePath,
  validateMaterial,
  youtubeEmbedUrl,
  youtubeVideoId,
} from "./materialType";

describe("material types", () => {
  it("labels every type", () => {
    MATERIAL_TYPES.forEach((t) => expect(MATERIAL_LABELS[t].trim()).not.toBe(""));
  });
});

describe("youtubeVideoId", () => {
  it("reads a standard watch URL", () => {
    expect(youtubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("keeps working with extra query params", () => {
    expect(youtubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s&list=PL1")).toBe("dQw4w9WgXcQ");
  });

  it("reads a short youtu.be link", () => {
    expect(youtubeVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeVideoId("https://youtu.be/dQw4w9WgXcQ?t=30")).toBe("dQw4w9WgXcQ");
  });

  it("reads embed, shorts and live URLs", () => {
    expect(youtubeVideoId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(youtubeVideoId("https://www.youtube.com/live/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("rejects non-YouTube and malformed URLs", () => {
    expect(youtubeVideoId("https://vimeo.com/12345")).toBeNull();
    expect(youtubeVideoId("https://notyoutube.com/watch?v=abc")).toBeNull();
    expect(youtubeVideoId("not a url")).toBeNull();
    expect(youtubeVideoId("")).toBeNull();
    expect(youtubeVideoId(null)).toBeNull();
  });

  it("builds a no-cookie embed URL", () => {
    expect(youtubeEmbedUrl("https://youtu.be/abc123")).toBe("https://www.youtube-nocookie.com/embed/abc123");
    expect(youtubeEmbedUrl("https://vimeo.com/1")).toBeNull();
    expect(isYoutubeUrl("https://youtu.be/abc123")).toBe(true);
    expect(isYoutubeUrl("https://vimeo.com/1")).toBe(false);
  });
});

describe("materialStoragePath", () => {
  it("keeps the key URL-safe when the filename is Arabic", () => {
    const path = materialStoragePath("summer", "abc-123", "كتاب التجويد.pdf");
    expect(path).toBe("summer/abc-123/file.pdf");
    expect(/^[\w\-/.]+$/.test(path)).toBe(true);
  });

  it("slugifies spaces and keeps the extension", () => {
    expect(materialStoragePath("madarij", "id1", "My Great Book.PDF")).toBe("madarij/id1/my-great-book.pdf");
  });

  it("handles a file with no extension", () => {
    expect(materialStoragePath("summer", "id1", "readme")).toBe("summer/id1/readme");
  });

  it("falls back to a general folder when the programme is unset", () => {
    expect(materialStoragePath("", "id1", "a.pdf")).toBe("general/id1/a.pdf");
  });

  it("truncates a very long name", () => {
    const path = materialStoragePath("summer", "id1", `${"x".repeat(120)}.pdf`);
    expect(path.length).toBeLessThan(80);
  });
});

describe("validateMaterial", () => {
  it("requires a title", () => {
    expect(validateMaterial({ material_type: "link", title: "  ", url: "https://a.com" }).ok).toBe(false);
  });

  it("requires a URL for a link", () => {
    expect(validateMaterial({ material_type: "link", title: "x" }).ok).toBe(false);
    expect(validateMaterial({ material_type: "link", title: "x", url: "https://a.com" }).ok).toBe(true);
  });

  it("accepts a book with either a URL or an uploaded file", () => {
    expect(validateMaterial({ material_type: "book", title: "x", url: "https://a.com/b.pdf" }).ok).toBe(true);
    expect(validateMaterial({ material_type: "book", title: "x", file: { name: "b.pdf", size: 10 } }).ok).toBe(true);
    expect(validateMaterial({ material_type: "book", title: "x" }).ok).toBe(false);
  });

  it("accepts a material that already has a stored file", () => {
    expect(validateMaterial({ material_type: "book", title: "x", hasStoredFile: true }).ok).toBe(true);
  });

  it("rejects a malformed or non-http URL", () => {
    expect(validateMaterial({ material_type: "link", title: "x", url: "javascript:alert(1)" }).ok).toBe(false);
    expect(validateMaterial({ material_type: "link", title: "x", url: "notaurl" }).ok).toBe(false);
  });

  it("rejects an oversized upload", () => {
    const res = validateMaterial({
      material_type: "file",
      title: "x",
      file: { name: "big.zip", size: 999 * 1024 * 1024 },
    });
    expect(res.ok).toBe(false);
    expect(res.error).toContain("ميجابايت");
  });
});
