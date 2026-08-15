import { describe, expect, test } from "vitest";

import { extractOfficialUnfurlImageUrl } from "./unfurl";

describe("extractOfficialUnfurlImageUrl", () => {
  test("extracts an Open Graph image regardless of attribute order", () => {
    expect(
      extractOfficialUnfurlImageUrl(
        '<html><head><meta content="/preview.jpg" property="og:image"></head></html>',
        "https://example.com/article",
      ),
    ).toBe("https://example.com/preview.jpg");
  });

  test("falls back to twitter image metadata", () => {
    expect(
      extractOfficialUnfurlImageUrl(
        '<meta name="twitter:image" content="https://cdn.example.com/card.png">',
        "https://example.com/article",
      ),
    ).toBe("https://cdn.example.com/card.png");
  });

  test("ignores data urls and unrelated images", () => {
    expect(
      extractOfficialUnfurlImageUrl(
        '<meta property="og:image" content="data:image/png;base64,abc"><img src="hero.jpg">',
        "https://example.com/article",
      ),
    ).toBeNull();
  });
});
