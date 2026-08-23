const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "www.youtube.com",
  "youtu.be",
  "www.youtu.be",
]);

function safeVideoId(value: string | null): string | null {
  return value && /^[A-Za-z0-9_-]{1,128}$/.test(value) ? value : null;
}

export function getYouTubeVideoId(value: string): string | null {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  const hostname = url.hostname.toLowerCase();
  if (!YOUTUBE_HOSTS.has(hostname)) {
    return null;
  }

  if (hostname.endsWith("youtu.be")) {
    return safeVideoId(url.pathname.slice(1).split("/")[0] ?? null);
  }

  if (url.pathname === "/watch") {
    return safeVideoId(url.searchParams.get("v"));
  }

  const pathMatch = url.pathname.match(/^\/(?:embed|v|shorts)\/([^/?#]+)/);
  return safeVideoId(pathMatch?.[1] ?? null);
}

export function isYouTubeUrl(value: string): boolean {
  return getYouTubeVideoId(value) !== null;
}

const TIMESTAMP_LINE =
  /^(?:\d{1,3}:)?\d{2}:\d{2}[,.]\d{3}\s+-->\s+(?:\d{1,3}:)?\d{2}:\d{2}[,.]\d{3}/;
const VTT_TIMESTAMP_LINE =
  /^(?:\d{1,3}:)?\d{2}:\d{2}\.\d{3}\s+-->\s+(?:\d{1,3}:)?\d{2}:\d{2}\.\d{3}/;
const LRC_TIMESTAMP_PREFIX = /^\[\d{1,2}:\d{2}(?:[.:]\d{2,3})?\]\s*/;

function stripCaptionMarkup(value: string): string {
  return value
    .replace(/<\/?[^>]+>/g, "")
    .replace(/\{\\[^}]+\}/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCaptionLines(input: string): string {
  const lines = input.replace(/^\uFEFF/, "").split(/\r?\n/);
  const output: string[] = [];
  let previous = "";

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (
      !line ||
      line === "WEBVTT" ||
      /^NOTE(?:\s|$)/.test(line) ||
      TIMESTAMP_LINE.test(line) ||
      VTT_TIMESTAMP_LINE.test(line) ||
      /^\d+$/.test(line)
    ) {
      continue;
    }

    const clean = stripCaptionMarkup(line.replace(LRC_TIMESTAMP_PREFIX, ""));
    if (!clean || clean === previous) {
      continue;
    }
    output.push(clean);
    previous = clean;
  }

  return output.join("\n\n");
}

/** Convert common SRT/VTT-like subtitle files into readable source text. */
export function normalizeSubtitleText(input: string): string {
  const trimmed = input.trim();
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as {
        events?: { segs?: { utf8?: string }[] }[];
      };
      if (Array.isArray(parsed.events)) {
        return normalizeCaptionLines(
          parsed.events
            .flatMap((event) =>
              (event.segs ?? []).map((segment) => segment.utf8 ?? ""),
            )
            .join("\n"),
        );
      }
    } catch {
      // Fall through to the line-based normalizer for malformed caption data.
    }
  }

  const assDialogue = trimmed
    .split(/\r?\n/)
    .filter((line) => /^Dialogue\s*:/i.test(line))
    .map((line) => line.split(",", 10)[9] ?? "")
    .join("\n")
    .replace(/\\N/g, "\n");
  if (assDialogue) {
    return normalizeCaptionLines(assDialogue);
  }

  const xmlParagraphs = [
    ...trimmed.matchAll(/<(?:p|text)\b[^>]*>([\s\S]*?)<\/(?:p|text)>/gi),
  ]
    .map((match) => match[1])
    .join("\n");
  return normalizeCaptionLines(xmlParagraphs || input);
}

export function subtitleContentType(fileName: string): string {
  const extension = fileName.toLowerCase().split(".").pop();
  switch (extension) {
    case "vtt":
      return "text/vtt";
    case "srt":
      return "application/x-subrip";
    case "ttml":
    case "dfxp":
      return "application/ttml+xml";
    case "ass":
      return "text/x-ssa";
    case "ssa":
      return "text/x-ssa";
    case "json3":
      return "application/json";
    default:
      return "text/plain";
  }
}
