from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    count = text.count(old)
    if count != 1:
        raise SystemExit(f"{path}: expected exactly one match, found {count}")
    file.write_text(text.replace(old, new, 1))


# Decode HTML entities in OG/Twitter metadata URLs.
unfurl = Path("apps/workers/workers/utils/unfurl.ts")
text = unfurl.read_text()
if 'import { decode } from "html-entities";' not in text:
    text = 'import { decode } from "html-entities";\n\n' + text
old = '''    const content = attributes.get("content")?.trim();
    if (!content || content.startsWith("data:")) {'''
new = '''    const rawContent = attributes.get("content")?.trim();
    const content = rawContent ? decode(rawContent) : rawContent;
    if (!content || content.startsWith("data:")) {'''
if old not in text:
    raise SystemExit("unfurl.ts: content extraction block not found")
unfurl.write_text(text.replace(old, new, 1))

replace_once(
    "apps/workers/workers/utils/unfurl.test.ts",
    '''  test("ignores data urls and unrelated images", () => {
    expect(
      extractOfficialUnfurlImageUrl(
        '<meta property="og:image" content="data:image/png;base64,abc"><img src="hero.jpg">',
        "https://example.com/article",
      ),
    ).toBeNull();
  });''',
    '''  test("decodes HTML entities in image URLs", () => {
    expect(
      extractOfficialUnfurlImageUrl(
        '<meta property="og:image" content="https://cdn.example.com/card.jpg?w=1200&amp;h=630">',
        "https://example.com/article",
      ),
    ).toBe("https://cdn.example.com/card.jpg?w=1200&h=630");
  });

  test("ignores data urls and unrelated images", () => {
    expect(
      extractOfficialUnfurlImageUrl(
        '<meta property="og:image" content="data:image/png;base64,abc"><img src="hero.jpg">',
        "https://example.com/article",
      ),
    ).toBeNull();
  });

  test("rejects non-http(s) protocols", () => {
    expect(
      extractOfficialUnfurlImageUrl(
        '<meta property="og:image" content="file:///etc/passwd">',
        "https://example.com/article",
      ),
    ).toBeNull();
  });

  test("returns null when no unfurl metadata is present", () => {
    expect(
      extractOfficialUnfurlImageUrl(
        "<html><head><title>No metadata</title></head></html>",
        "https://example.com/article",
      ),
    ).toBeNull();
  });''',
)

# Keep the shared inference queue transparent. Automatic-summary gating belongs
# at automatic callers so explicit/admin queue users keep their existing behavior.
replace_once(
    "packages/shared-server/src/queues.ts",
    'import serverConfig from "@karakeep/shared/config";\n',
    "",
)
replace_once(
    "packages/shared-server/src/queues.ts",
    '''const deferredOpenAIQueue = createDeferredQueue<ZOpenAIRequest>(
  "openai_queue",
  {
    defaultJobArgs: {
      numRetries: 3,
    },
    keepFailedJobs: false,
  },
);

export const OpenAIQueue: Queue<ZOpenAIRequest> = {
  ...deferredOpenAIQueue,
  async enqueue(payload, opts) {
    // Automatic batch summarization is globally disabled when this switch is
    // off. The worker already no-ops in that state; skipping the queue entry
    // avoids pointless pending work while manual per-bookmark summarize stays
    // on its direct inference path.
    if (
      payload.type === "summarize" &&
      !serverConfig.inference.enableAutoSummarization
    ) {
      return undefined;
    }
    return deferredOpenAIQueue.enqueue(payload, opts);
  },
};''',
    '''export const OpenAIQueue = createDeferredQueue<ZOpenAIRequest>("openai_queue", {
  defaultJobArgs: {
    numRetries: 3,
  },
  keepFailedJobs: false,
});''',
)

crawler = "apps/workers/workers/crawlerWorker.ts"
replace_once(
    crawler,
    'const PAGE_CLOSE_TIMEOUT_MS = 5_000;\n',
    'const PAGE_CLOSE_TIMEOUT_MS = 5_000;\nconst UNFURL_IMAGE_DOWNLOAD_TIMEOUT_MS = 3_000;\n',
)
replace_once(
    crawler,
    '''  statusCode: number;
  url: string;
  unfurlImage: DownloadedAsset | null;
  browserThumbnailHandled: boolean;
}''',
    '''  statusCode: number;
  url: string;
  officialUnfurlImageUrl: string | null;
  officialUnfurlImageAttempted: boolean;
  unfurlImage: DownloadedAsset | null;
}''',
)
replace_once(
    crawler,
    '''      return {
        htmlContent: await response.text(),
        statusCode: response.status,
        screenshot: undefined,
        pdf: undefined,
        url: response.url,
        unfurlImage: null,
        browserThumbnailHandled: false,
      };''',
    '''      const htmlContent = await response.text();
      return {
        htmlContent,
        statusCode: response.status,
        screenshot: undefined,
        pdf: undefined,
        url: response.url,
        officialUnfurlImageUrl: extractOfficialUnfurlImageUrl(
          htmlContent,
          response.url,
        ),
        officialUnfurlImageAttempted: false,
        unfurlImage: null,
      };''',
)
replace_once(
    crawler,
    '''        let unfurlImage: DownloadedAsset | null = null;
        if (officialUnfurlImageUrl) {
          unfurlImage = await downloadAndStoreImage(
            officialUnfurlImageUrl,
            userId,
            jobId,
            abortSignal,
            runProxy,
          );
          abortSignal.throwIfAborted();
        }''',
    '''        let unfurlImage: DownloadedAsset | null = null;
        if (officialUnfurlImageUrl) {
          const unfurlAbortSignal = AbortSignal.any([
            abortSignal,
            AbortSignal.timeout(UNFURL_IMAGE_DOWNLOAD_TIMEOUT_MS),
          ]);
          unfurlImage = await downloadAndStoreImage(
            officialUnfurlImageUrl,
            userId,
            jobId,
            unfurlAbortSignal,
            runProxy,
          );
          abortSignal.throwIfAborted();
        }''',
)
replace_once(
    crawler,
    '''          pdf,
          url: activePage.url(),
          unfurlImage,
          browserThumbnailHandled: true,
        };''',
    '''          pdf,
          url: activePage.url(),
          officialUnfurlImageUrl,
          officialUnfurlImageAttempted: officialUnfurlImageUrl !== null,
          unfurlImage,
        };''',
)
replace_once(
    crawler,
    '''        result = {
          htmlContent: asset.asset.toString(),
          screenshot: undefined,
          pdf: undefined,
          statusCode: 200,
          url,
          unfurlImage: null,
          browserThumbnailHandled: false,
        };''',
    '''        const htmlContent = asset.asset.toString();
        result = {
          htmlContent,
          screenshot: undefined,
          pdf: undefined,
          statusCode: 200,
          url,
          officialUnfurlImageUrl: extractOfficialUnfurlImageUrl(
            htmlContent,
            url,
          ),
          officialUnfurlImageAttempted: false,
          unfurlImage: null,
        };''',
)
replace_once(
    crawler,
    '''      const officialUnfurlImageUrl = extractOfficialUnfurlImageUrl(
        htmlContent,
        browserUrl,
      );
      const previewImageUrl = officialUnfurlImageUrl ?? meta.image;''',
    '''      const previewImageUrl = result.officialUnfurlImageUrl ?? meta.image;''',
)
replace_once(
    crawler,
    '''      let readableContent = parsedReadableContent;

      const [screenshotAssetInfo, pdfAssetInfo, htmlContentAssetInfo] =
        await Promise.all([
          raceWith(
            storeScreenshot(screenshot, userId, jobId),
            abortRace(abortSignal),
          ),
          raceWith(storePdf(pdf, userId, jobId), abortRace(abortSignal)),
          storeHtmlContent(readableContent?.content, userId, jobId),
        ] as const);
      abortSignal.throwIfAborted();

      let imageAssetInfo: DBAssetType | null = result.unfurlImage
        ? {
            id: result.unfurlImage.assetId,
            bookmarkId,
            userId,
            assetType: AssetTypes.LINK_BANNER_IMAGE,
            contentType: result.unfurlImage.contentType,
            size: result.unfurlImage.size,
          }
        : null;

      if (!result.browserThumbnailHandled && previewImageUrl) {
        const downloaded = await downloadAndStoreImage(
          previewImageUrl,
          userId,
          jobId,
          abortSignal,
          runProxy,
        );
        if (downloaded) {
          imageAssetInfo = {
            id: downloaded.assetId,
            bookmarkId,
            userId,
            assetType: AssetTypes.LINK_BANNER_IMAGE,
            contentType: downloaded.contentType,
            size: downloaded.size,
          };
        }
      }
      abortSignal.throwIfAborted();''',
    '''      let readableContent = parsedReadableContent;

      let imageAssetInfo: DBAssetType | null = result.unfurlImage
        ? {
            id: result.unfurlImage.assetId,
            bookmarkId,
            userId,
            assetType: AssetTypes.LINK_BANNER_IMAGE,
            contentType: result.unfurlImage.contentType,
            size: result.unfurlImage.size,
          }
        : null;

      if (!imageAssetInfo) {
        const fallbackImageUrl =
          result.officialUnfurlImageAttempted &&
          meta.image &&
          meta.image !== result.officialUnfurlImageUrl
            ? meta.image
            : previewImageUrl;
        if (fallbackImageUrl) {
          const unfurlAbortSignal = AbortSignal.any([
            abortSignal,
            AbortSignal.timeout(UNFURL_IMAGE_DOWNLOAD_TIMEOUT_MS),
          ]);
          const downloaded = await downloadAndStoreImage(
            fallbackImageUrl,
            userId,
            jobId,
            unfurlAbortSignal,
            runProxy,
          );
          abortSignal.throwIfAborted();
          if (downloaded) {
            imageAssetInfo = {
              id: downloaded.assetId,
              bookmarkId,
              userId,
              assetType: AssetTypes.LINK_BANNER_IMAGE,
              contentType: downloaded.contentType,
              size: downloaded.size,
            };
          }
        }
      }

      // Preserve the pre-PR check/save ordering. Quota approvals are based on
      // current persisted usage and do not reserve bytes, so these calls must
      // not perform their checks concurrently.
      const screenshotAssetInfo = await raceWith(
        storeScreenshot(imageAssetInfo ? undefined : screenshot, userId, jobId),
        abortRace(abortSignal),
      );
      abortSignal.throwIfAborted();

      const pdfAssetInfo = await raceWith(
        storePdf(pdf, userId, jobId),
        abortRace(abortSignal),
      );
      abortSignal.throwIfAborted();

      const htmlContentAssetInfo = await storeHtmlContent(
        readableContent?.content,
        userId,
        jobId,
      );
      abortSignal.throwIfAborted();''',
)
replace_once(
    crawler,
    '        } else if (result.browserThumbnailHandled && oldImageAssetId) {',
    '        } else if (!previewImageUrl && oldImageAssetId) {',
)
replace_once(
    crawler,
    '''      await OpenAIQueue.enqueue(
        { bookmarkId, type: "summarize" },
        enqueueOpts,
      );''',
    '''      if (serverConfig.inference.enableAutoSummarization) {
        await OpenAIQueue.enqueue(
          { bookmarkId, type: "summarize" },
          enqueueOpts,
        );
      } else {
        await db
          .update(bookmarks)
          .set({ summarizationStatus: null })
          .where(
            and(
              eq(bookmarks.id, bookmarkId),
              eq(bookmarks.summarizationStatus, "pending"),
            ),
          );
      }''',
)

# Asset preprocessing is another automatic summarization caller.
replace_once(
    "apps/workers/workers/assetPreprocessingWorker.ts",
    '''    await OpenAIQueue.enqueue(
      {
        bookmarkId,
        type: "summarize",
      },
      enqueueOpts,
    );''',
    '''    if (serverConfig.inference.enableAutoSummarization) {
      await OpenAIQueue.enqueue(
        {
          bookmarkId,
          type: "summarize",
        },
        enqueueOpts,
      );
    } else {
      await db
        .update(bookmarks)
        .set({ summarizationStatus: null })
        .where(
          and(
            eq(bookmarks.id, bookmarkId),
            eq(bookmarks.summarizationStatus, "pending"),
          ),
        );
    }''',
)

# Terminal crawl failures stop loading and polling.
replace_once(
    "packages/shared/utils/bookmarkUtils.test.ts",
    '''  test("a link is still loading while its core crawl is pending", () => {
    const bookmark = linkBookmark({
      crawlStatus: "pending",
      crawledAt: null,
      taggingStatus: "pending",
      summarizationStatus: "pending",
    });

    expect(isBookmarkStillLoading(bookmark)).toBe(true);
    expect(getBookmarkRefreshInterval(bookmark)).toBe(1000);
  });''',
    '''  test("a link is still loading while its core crawl is pending", () => {
    const bookmark = linkBookmark({
      crawlStatus: "pending",
      crawledAt: null,
      taggingStatus: "pending",
      summarizationStatus: "pending",
    });

    expect(isBookmarkStillLoading(bookmark)).toBe(true);
    expect(getBookmarkRefreshInterval(bookmark)).toBe(1000);
  });

  test("a failed crawl stops bookmark loading and polling", () => {
    const bookmark = linkBookmark({
      crawlStatus: "failure",
      crawledAt: null,
    });

    expect(isBookmarkStillLoading(bookmark)).toBe(false);
    expect(getBookmarkRefreshInterval(bookmark)).toBe(false);
  });''',
)

# Pin the disabled-auto-summary path and cover the enabled lifecycle.
test_file = Path("packages/trpc/routers/bookmarks.test.ts")
text = test_file.read_text()
if 'import serverConfig from "@karakeep/shared/config";' not in text:
    text = text.replace(
        'import * as sharedServer from "@karakeep/shared-server";\n',
        'import * as sharedServer from "@karakeep/shared-server";\nimport serverConfig from "@karakeep/shared/config";\n',
        1,
    )
marker = '''  test<CustomTestContext>("returns only the current account's active processing work", async ({
    apiCallers,
    db,
  }) => {
    const api = apiCallers[0].bookmarks;'''
replacement = '''  test<CustomTestContext>("returns only the current account's active processing work", async ({
    apiCallers,
    db,
  }) => {
    serverConfig.inference.enableAutoSummarization = false;
    const api = apiCallers[0].bookmarks;'''
if marker not in text:
    raise SystemExit("bookmarks.test.ts: processing test marker not found")
text = text.replace(marker, replacement, 1)
assertion = '''    await expect(api.getProcessingStatus()).resolves.toEqual({
      total: 4,
      tasks: [
        { kind: "crawling", count: 1 },
        { kind: "tagging", count: 2 },
        { kind: "importing", count: 1 },
      ],
    });
  });'''
enabled = assertion + '''

  test<CustomTestContext>("tracks summarization when auto summarization is enabled", async ({
    apiCallers,
  }) => {
    const api = apiCallers[0].bookmarks;
    serverConfig.inference.enableAutoSummarization = true;
    try {
      const created = await api.createBookmark({
        url: "https://summary-pending.example",
        type: BookmarkTypes.LINK,
      });
      const bookmark = await api.getBookmark({ bookmarkId: created.id });
      expect(bookmark.summarizationStatus).toBe("pending");
      await expect(api.getProcessingStatus()).resolves.toEqual({
        total: 3,
        tasks: [
          { kind: "crawling", count: 1 },
          { kind: "tagging", count: 1 },
          { kind: "summarizing", count: 1 },
        ],
      });
    } finally {
      serverConfig.inference.enableAutoSummarization = false;
    }
  });'''
if text.count(assertion) != 1:
    raise SystemExit("bookmarks.test.ts: expected processing assertion once")
test_file.write_text(text.replace(assertion, enabled, 1))
