import Link from "next/link";
import { FullPageSpinner } from "@/components/ui/full-page-spinner";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n/client";
import { useQuery } from "@tanstack/react-query";
import { FileX, RotateCw } from "lucide-react";

import { MarkdownReadonly } from "@/components/ui/markdown/markdown-readonly";
import BookmarkHTMLHighlighter from "@karakeep/shared-react/components/BookmarkHtmlHighlighter";
import ScrollProgressTracker from "@karakeep/shared-react/components/ScrollProgressTracker";
import {
  useCreateHighlight,
  useDeleteHighlight,
  useUpdateHighlight,
} from "@karakeep/shared-react/hooks/highlights";
import { useReadingProgress } from "@karakeep/shared-react/hooks/reading-progress";
import { useTRPC } from "@karakeep/shared-react/trpc";
import { BookmarkTypes } from "@karakeep/shared/types/bookmarks";

import ReadingProgressBanner from "./ReadingProgressBanner";

function ReaderState({
  title,
  description,
  action,
  fallbackHref,
  onRetry,
}: {
  title: string;
  description: string;
  action?: string;
  fallbackHref?: string;
  onRetry?: () => void;
}) {
  return (
    <div
      className="flex min-h-64 w-full items-center justify-center p-4"
      role={onRetry ? "alert" : "status"}
    >
      <div className="max-w-md space-y-4 text-center">
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <FileX
              className="h-8 w-8 text-muted-foreground"
              aria-hidden="true"
            />
          </div>
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-medium text-foreground">{title}</h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>
        {(onRetry || fallbackHref) && (
          <div className="flex flex-wrap justify-center gap-2">
            {onRetry && (
              <Button variant="outline" onClick={onRetry}>
                <RotateCw className="mr-2 size-4" aria-hidden="true" />
                Retry
              </Button>
            )}
            {fallbackHref && (
              <Button asChild>
                <Link href={fallbackHref}>{action ?? "Open preview"}</Link>
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ReaderTextContent({
  text,
  format,
}: {
  text: string;
  format?: "markdown" | "plain";
}) {
  if ((format ?? "markdown") === "plain") {
    return (
      <pre className="whitespace-pre-wrap break-words font-sans">{text}</pre>
    );
  }

  return <MarkdownReadonly allowTodoToggle={false}>{text}</MarkdownReadonly>;
}

export default function ReaderView({
  bookmarkId,
  className,
  style,
  readOnly,
  progressBarStyle,
  fallbackHref,
}: {
  bookmarkId: string;
  className?: string;
  style?: React.CSSProperties;
  readOnly: boolean;
  progressBarStyle?: React.CSSProperties;
  fallbackHref?: string;
}) {
  const { t } = useTranslation();
  const api = useTRPC();
  const { data: highlights } = useQuery(
    api.highlights.getForBookmark.queryOptions({
      bookmarkId,
    }),
  );
  const {
    data: bookmark,
    isPending: isBookmarkLoading,
    isError: isBookmarkError,
    refetch: refetchBookmark,
  } = useQuery(
    api.bookmarks.getBookmark.queryOptions({
      bookmarkId,
      includeContent: true,
    }),
  );

  const {
    showBanner,
    bannerPercent,
    onContinue,
    onDismiss,
    restorePosition,
    readingProgressOffset,
    readingProgressAnchor,
    onSavePosition,
    onScrollPositionChange,
  } = useReadingProgress({
    bookmarkId,
  });

  const { mutate: createHighlight } = useCreateHighlight({
    onSuccess: () => {
      toast({
        description: "Highlight has been created!",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        description: "Something went wrong",
      });
    },
  });

  const { mutate: updateHighlight } = useUpdateHighlight({
    onSuccess: () => {
      toast({
        description: "Highlight has been updated!",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        description: "Something went wrong",
      });
    },
  });

  const { mutate: deleteHighlight } = useDeleteHighlight({
    onSuccess: () => {
      toast({
        description: "Highlight has been deleted!",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        description: "Something went wrong",
      });
    },
  });

  const renderReader = (readerContent: React.ReactNode) => (
    <ScrollProgressTracker
      onSavePosition={onSavePosition}
      onScrollPositionChange={onScrollPositionChange}
      restorePosition={restorePosition}
      readingProgressOffset={readingProgressOffset}
      readingProgressAnchor={readingProgressAnchor}
      showProgressBar
      progressBarStyle={progressBarStyle}
    >
      {showBanner && (
        <ReadingProgressBanner
          percent={bannerPercent}
          onContinue={onContinue}
          onDismiss={onDismiss}
        />
      )}
      <BookmarkHTMLHighlighter
        className={className}
        style={style}
        highlights={highlights?.highlights ?? []}
        readOnly={readOnly}
        onDeleteHighlight={(h) =>
          deleteHighlight({
            highlightId: h.id,
          })
        }
        onUpdateHighlight={(h) =>
          updateHighlight({
            highlightId: h.id,
            color: h.color,
            note: h.note,
          })
        }
        onHighlight={(h) =>
          createHighlight({
            startOffset: h.startOffset,
            endOffset: h.endOffset,
            color: h.color,
            bookmarkId,
            text: h.text,
            note: h.note ?? null,
          })
        }
      >
        {readerContent}
      </BookmarkHTMLHighlighter>
    </ScrollProgressTracker>
  );

  let content: React.ReactNode;
  if (isBookmarkLoading) {
    content = <FullPageSpinner />;
  } else if (isBookmarkError || !bookmark) {
    content = (
      <ReaderState
        title="Reader View unavailable"
        description="The bookmark could not be loaded. Try again or return to the preview."
        fallbackHref={fallbackHref}
        onRetry={() => void refetchBookmark()}
      />
    );
  } else if (bookmark.content.type === BookmarkTypes.TEXT) {
    content = renderReader(
      <ReaderTextContent
        text={bookmark.content.text}
        format={bookmark.content.format}
      />,
    );
  } else if (bookmark.content.type === BookmarkTypes.LINK) {
    if (bookmark.content.crawlStatus === "pending") {
      content = (
        <ReaderState
          title="Reader View is not ready yet"
          description={t("preview.crawling_in_progress")}
          fallbackHref={fallbackHref}
        />
      );
    } else if (bookmark.content.crawlStatus === "failure") {
      content = (
        <ReaderState
          title={t("preview.fetch_error_title")}
          description={t("preview.fetch_error_description")}
          fallbackHref={fallbackHref}
        />
      );
    } else if (!bookmark.content.htmlContent) {
      content = (
        <ReaderState
          title="No readable content"
          description="This bookmark does not have readable content available yet."
          fallbackHref={fallbackHref}
        />
      );
    } else {
      content = (
        <ScrollProgressTracker
          onSavePosition={onSavePosition}
          onScrollPositionChange={onScrollPositionChange}
          restorePosition={restorePosition}
          readingProgressOffset={readingProgressOffset}
          readingProgressAnchor={readingProgressAnchor}
          showProgressBar
          progressBarStyle={progressBarStyle}
        >
          {showBanner && (
            <ReadingProgressBanner
              percent={bannerPercent}
              onContinue={onContinue}
              onDismiss={onDismiss}
            />
          )}
          <BookmarkHTMLHighlighter
            className={className}
            style={style}
            htmlContent={bookmark.content.htmlContent}
            highlights={highlights?.highlights ?? []}
            readOnly={readOnly}
            onDeleteHighlight={(h) => deleteHighlight({ highlightId: h.id })}
            onUpdateHighlight={(h) =>
              updateHighlight({
                highlightId: h.id,
                color: h.color,
                note: h.note,
              })
            }
            onHighlight={(h) =>
              createHighlight({
                startOffset: h.startOffset,
                endOffset: h.endOffset,
                color: h.color,
                bookmarkId,
                text: h.text,
                note: h.note ?? null,
              })
            }
          />
        </ScrollProgressTracker>
      );
    }
  } else {
    content = (
      <ReaderState
        title="Reader View is not available"
        description="This content uses a dedicated preview instead of Reader View."
        action="Open preview"
        fallbackHref={fallbackHref}
      />
    );
  }

  return content;
}
