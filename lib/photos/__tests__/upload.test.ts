import { describe, expect, it } from "vitest";
import { checkOriginal, checkUpload, fitWithin, MAX_UPLOAD_BYTES } from "../upload";

describe("checkOriginal", () => {
  it("accepts phone photos, including HEIC with no type", () => {
    expect(checkOriginal({ type: "image/jpeg", size: 5_000_000, name: "a.jpg" }).ok).toBe(true);
    expect(checkOriginal({ type: "", size: 3_000_000, name: "IMG_1.HEIC" }).ok).toBe(true);
  });
  it("rejects videos, empty and huge files", () => {
    expect(checkOriginal({ type: "video/mp4", size: 1000, name: "a.mp4" })).toEqual({
      ok: false,
      reason: "notImage",
    });
    expect(checkOriginal({ type: "image/jpeg", size: 0, name: "a.jpg" })).toEqual({
      ok: false,
      reason: "empty",
    });
    expect(checkOriginal({ type: "image/jpeg", size: 50_000_000, name: "a.jpg" })).toEqual({
      ok: false,
      reason: "tooBig",
    });
  });
});

describe("checkUpload", () => {
  it("accepts shrunk JPEGs under the limit", () => {
    expect(checkUpload({ type: "image/jpeg", size: 800_000 }).ok).toBe(true);
  });
  it("rejects HEIC and files over the limit", () => {
    expect(checkUpload({ type: "image/heic", size: 800_000 }).ok).toBe(false);
    expect(checkUpload({ type: "image/jpeg", size: MAX_UPLOAD_BYTES + 1 }).ok).toBe(false);
  });
});

describe("fitWithin", () => {
  it("shrinks the longest side and keeps the shape", () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: 2048, height: 1536 });
    expect(fitWithin(3024, 4032)).toEqual({ width: 1536, height: 2048 });
  });
  it("never enlarges small photos", () => {
    expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
  });
});
