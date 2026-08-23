import { describe, expect, it } from "vitest";

import {
  getYouTubeVideoId,
  isYouTubeUrl,
  normalizeSubtitleText,
  subtitleContentType,
} from "./youtube";

describe("YouTube transcript helpers", () => {
  it("recognizes canonical YouTube URL forms by video id", () => {
    expect(getYouTubeVideoId("https://www.youtube.com/watch?v=abc123")).toBe(
      "abc123",
    );
    expect(getYouTubeVideoId("https://youtu.be/abc123?t=10")).toBe("abc123");
    expect(getYouTubeVideoId("https://youtube.com/shorts/abc123")).toBe(
      "abc123",
    );
    expect(getYouTubeVideoId("https://youtube.com/watch?v=../secrets")).toBe(
      null,
    );
    expect(isYouTubeUrl("https://example.com/watch?v=abc123")).toBe(false);
  });

  it("normalizes SRT and removes repeated caption cues", () => {
    expect(
      normalizeSubtitleText(
        "1\n00:00:01,000 --> 00:00:02,000\nHello\n\n2\n00:00:02,000 --> 00:00:03,000\nHello\n\n3\n00:00:03,000 --> 00:00:04,000\nWorld",
      ),
    ).toBe("Hello\n\nWorld");
  });

  it("normalizes JSON3 and common subtitle formats", () => {
    expect(
      normalizeSubtitleText(
        JSON.stringify({
          events: [
            { segs: [{ utf8: "Hello " }, { utf8: "world" }] },
            { segs: [{ utf8: "world" }, { utf8: "!" }] },
          ],
        }),
      ),
    ).toBe("Hello world\n\nworld!");
    expect(
      normalizeSubtitleText(
        "[Script Info]\n[Events]\nDialogue: 0,0:00:01.00,0:00:02.00,Default,,0,0,0,,Hello, world\\Nagain",
      ),
    ).toBe("Hello, world\n\nagain");
    expect(normalizeSubtitleText("[00:01.00]Hello\n[00:02.00]World")).toBe(
      "Hello\n\nWorld",
    );
    expect(
      normalizeSubtitleText(
        "WEBVTT - English\n\n00:00:01.000 --> 00:00:02.000\nHello",
      ),
    ).toBe("Hello");
    expect(subtitleContentType("captions.vtt")).toBe("text/vtt");
    expect(subtitleContentType("captions.srt")).toBe("application/x-subrip");
  });
});
