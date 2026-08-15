const UNFURL_IMAGE_KEYS = new Set([
  "og:image",
  "og:image:url",
  "og:image:secure_url",
  "twitter:image",
  "twitter:image:src",
]);

function parseMetaAttributes(tag: string): Map<string, string> {
  const attributes = new Map<string, string>();
  const pattern = /([^\s=/>]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g;

  for (const match of tag.matchAll(pattern)) {
    const name = match[1]?.toLowerCase();
    const value = match[2] ?? match[3] ?? match[4];
    if (name && value !== undefined) {
      attributes.set(name, value);
    }
  }

  return attributes;
}

export function extractOfficialUnfurlImageUrl(
  html: string,
  pageUrl: string,
): string | null {
  const tags = html.match(/<meta\b[^>]*>/gi) ?? [];

  for (const tag of tags) {
    const attributes = parseMetaAttributes(tag);
    const key = (
      attributes.get("property") ?? attributes.get("name") ?? ""
    ).toLowerCase();
    if (!UNFURL_IMAGE_KEYS.has(key)) {
      continue;
    }

    const content = attributes.get("content")?.trim();
    if (!content || content.startsWith("data:")) {
      continue;
    }

    try {
      const resolved = new URL(content, pageUrl);
      if (resolved.protocol === "http:" || resolved.protocol === "https:") {
        return resolved.toString();
      }
    } catch {
      continue;
    }
  }

  return null;
}
