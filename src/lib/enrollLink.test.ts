import { describe, it, expect } from "vitest";
import { ENROLL_PATH, enrollUrl } from "./enrollLink";

describe("enrollUrl", () => {
  it("builds the public registration URL from an origin", () => {
    expect(enrollUrl("https://quran-circle.enter.com.sa")).toBe(
      "https://quran-circle.enter.com.sa/enroll",
    );
  });

  it("does not double the slash when the origin already ends with one", () => {
    expect(enrollUrl("https://example.com/")).toBe("https://example.com/enroll");
    expect(enrollUrl("https://example.com///")).toBe("https://example.com/enroll");
  });

  it("tolerates an empty origin", () => {
    expect(enrollUrl("")).toBe(ENROLL_PATH);
  });

  it("keeps a port", () => {
    expect(enrollUrl("http://localhost:8080")).toBe("http://localhost:8080/enroll");
  });
});
