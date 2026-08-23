import { describe, expect, it } from "vitest";

import {
  BOOKMARK_ASSET_TYPES,
  getDropzoneAccept,
  getBookmarkAssetTypeForMimeType,
  getFilePickerAccept,
  getSupportedMimeTypes,
  isContentTypeCompatibleWithAttachment,
  isMarkdownFile,
} from "./content-support";

describe("content support registry", () => {
  it("keeps the top-level asset contract limited to renderable asset types", () => {
    expect(BOOKMARK_ASSET_TYPES).toEqual(["image", "pdf"]);
    expect(getBookmarkAssetTypeForMimeType("image/webp")).toBe("image");
    expect(getBookmarkAssetTypeForMimeType("application/pdf")).toBe("pdf");
    expect(getBookmarkAssetTypeForMimeType("video/mp4")).toBeNull();
    expect(getBookmarkAssetTypeForMimeType("text/html")).toBeNull();
  });

  it("keeps upload and attachment capabilities broader than top-level bookmarks", () => {
    expect([...getSupportedMimeTypes("upload")]).toEqual([
      "image/gif",
      "image/jpeg",
      "image/png",
      "image/webp",
      "application/pdf",
      "video/mp4",
      "video/webm",
      "video/x-matroska",
      "text/html",
    ]);
    expect(getSupportedMimeTypes("attachment")).toEqual(
      getSupportedMimeTypes("upload"),
    );
    expect([...getSupportedMimeTypes("rawDownload")]).toEqual([
      ...getSupportedMimeTypes("upload"),
      "application/json",
      "application/ttml+xml",
      "application/x-subrip",
      "text/plain",
      "text/ssa",
      "text/vtt",
      "text/x-ssa",
      "application/zip",
    ]);
    expect(getFilePickerAccept("banner")).toBe(
      "image/gif,image/jpeg,image/png,image/webp,.gif,.jpeg,.jpg,.png,.webp",
    );
    expect(getFilePickerAccept("attachment")).toContain("video/mp4");
    expect(getFilePickerAccept("attachment")).toContain(".mkv");
    expect(getDropzoneAccept("topLevel")).toMatchObject({
      "image/jpeg": [".gif", ".jpeg", ".jpg", ".png", ".webp"],
      "application/pdf": [".pdf"],
      "text/markdown": [".md", ".markdown"],
    });
  });

  it("recognizes Markdown by MIME type or extension for the text bookmark path", () => {
    expect(isMarkdownFile("notes.md", "application/octet-stream")).toBe(true);
    expect(isMarkdownFile("notes.markdown", "text/markdown")).toBe(true);
    expect(isMarkdownFile("notes.txt", "text/plain")).toBe(false);
  });

  it("matches attached asset roles to their renderable MIME types", () => {
    expect(
      isContentTypeCompatibleWithAttachment("bannerImage", "image/png"),
    ).toBe(true);
    expect(
      isContentTypeCompatibleWithAttachment("bannerImage", "video/mp4"),
    ).toBe(false);
    expect(isContentTypeCompatibleWithAttachment("video", "video/webm")).toBe(
      true,
    );
    expect(
      isContentTypeCompatibleWithAttachment("precrawledArchive", "text/html"),
    ).toBe(true);
    expect(
      isContentTypeCompatibleWithAttachment("userUploaded", "video/x-matroska"),
    ).toBe(true);
  });
});
