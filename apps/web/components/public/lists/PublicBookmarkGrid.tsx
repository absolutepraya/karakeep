"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import BookmarkFormattedCreatedAt from "@/components/dashboard/bookmarks/BookmarkFormattedCreatedAt";
import { BookmarkMarkdownComponent } from "@/components/dashboard/bookmarks/BookmarkMarkdownComponent";
import FooterLinkURL from "@/components/dashboard/bookmarks/FooterLinkURL";
import { ActionButton } from "@/components/ui/action-button";
import { badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { SCREENS } from "@/lib/breakpoints";
import { cn } from "@/lib/utils";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Expand, FileIcon, ImageIcon } from "lucide-react";
import { useInView } from "react-intersection-observer";
import Masonry from "react-masonry-css";

import { useTRPC } from "@karakeep/shared-react/trpc";
import {
  BookmarkTypes,
  ZPublicBookmark,
} from "@karakeep/shared/types/bookmarks";
import { ZCursor } from "@karakeep/shared/types/pagination";

function TagPill({ tag }: { tag: string }) {
  return (
    <div
      className={cn(
        badgeVariants({ variant: "secondary" }),
        "ease-(--ease-out) border border-border/70 bg-muted/40 font-medium text-muted-foreground transition-[background-color,color,border-color] duration-150 hover:bg-accent hover:text-foreground",
      )}
    >
      {tag}
    </div>
  );
}

function BookmarkDetails({ bookmark }: { bookmark: ZPublicBookmark }) {
  const isLink = bookmark.content.type === BookmarkTypes.LINK;

  return (
    <>
      {bookmark.tags.length > 0 && (
        <div className="hidden flex-wrap gap-1.5 sm:flex">
          {bookmark.tags.map((tag) => (
            <TagPill key={tag} tag={tag} />
          ))}
        </div>
      )}

      <div className="flex w-full shrink-0 flex-col gap-1.5 border-t border-border/60 pt-2 text-xs text-muted-foreground sm:flex-row sm:items-center sm:gap-2 sm:pt-2.5 sm:text-sm">
        <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
          {isLink && <FooterLinkURL url={bookmark.content.url} />}
          {isLink && (
            <span aria-hidden className="hidden sm:inline">
              •
            </span>
          )}
          <BookmarkFormattedCreatedAt createdAt={bookmark.createdAt} />
        </div>
      </div>
    </>
  );
}

function BookmarkCard({ bookmark }: { bookmark: ZPublicBookmark }) {
  const renderContent = () => {
    switch (bookmark.content.type) {
      case BookmarkTypes.LINK:
        return (
          <>
            {bookmark.bannerImageUrl && (
              <div className="h-40 w-full shrink-0 overflow-hidden border-b border-border/60 bg-muted/20 sm:h-56">
                <Link
                  href={bookmark.content.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  {/* oxlint-disable-next-line no-img-element */}
                  <img
                    src={bookmark.bannerImageUrl}
                    alt={bookmark.title ?? "Link preview"}
                    className="ease-(--ease-out) h-full w-full object-cover transition-transform duration-300 hover:scale-[1.02]"
                  />
                </Link>
              </div>
            )}
            <div className="flex flex-col gap-2 p-3 sm:gap-2.5 sm:p-3.5">
              <Link
                href={bookmark.content.url}
                target="_blank"
                rel="noreferrer"
                className="ease-(--ease-out) line-clamp-2 overflow-hidden text-ellipsis break-words text-base font-semibold leading-snug tracking-tight transition-colors duration-150 hover:text-primary sm:text-lg"
              >
                {bookmark.title || "Untitled"}
              </Link>
              <BookmarkDetails bookmark={bookmark} />
            </div>
          </>
        );

      case BookmarkTypes.TEXT:
        return (
          <div className="flex flex-col gap-2 p-3 sm:gap-2.5 sm:p-3.5">
            {bookmark.title && (
              <h3 className="line-clamp-2 overflow-hidden text-ellipsis break-words text-base font-semibold leading-snug tracking-tight sm:text-lg">
                {bookmark.title}
              </h3>
            )}
            <div className="group relative max-h-40 overflow-hidden text-sm leading-6 text-foreground/90 sm:max-h-52 sm:text-base">
              <BookmarkMarkdownComponent readOnly={true}>
                {{
                  id: bookmark.id,
                  content: {
                    text: bookmark.content.text,
                  },
                }}
              </BookmarkMarkdownComponent>
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="shadow-xs absolute bottom-2 right-2 size-8 rounded-full border border-border/70 bg-background/90 opacity-100 transition-opacity duration-150 sm:opacity-0 sm:group-hover:opacity-100"
                    aria-label="Expand bookmark"
                  >
                    <Expand className="size-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-h-[80vh] max-w-3xl overflow-auto">
                  <BookmarkMarkdownComponent readOnly={true}>
                    {{
                      id: bookmark.id,
                      content: {
                        text: bookmark.content.text,
                      },
                    }}
                  </BookmarkMarkdownComponent>
                </DialogContent>
              </Dialog>
            </div>
            <BookmarkDetails bookmark={bookmark} />
          </div>
        );

      case BookmarkTypes.ASSET:
        return (
          <>
            {bookmark.bannerImageUrl ? (
              <div className="h-40 w-full shrink-0 overflow-hidden border-b border-border/60 bg-muted/20 sm:h-56">
                <Link
                  href={bookmark.content.assetUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  {/* oxlint-disable-next-line no-img-element */}
                  <img
                    src={bookmark.bannerImageUrl}
                    alt={bookmark.title ?? "Asset preview"}
                    className="ease-(--ease-out) h-full w-full object-cover transition-transform duration-300 hover:scale-[1.02]"
                  />
                </Link>
              </div>
            ) : (
              <div className="flex h-40 w-full shrink-0 items-center justify-center border-b border-border/60 bg-muted/20 text-muted-foreground sm:h-56">
                {bookmark.content.assetType === "image" ? (
                  <ImageIcon className="size-8" />
                ) : (
                  <FileIcon className="size-8" />
                )}
              </div>
            )}
            <div className="flex flex-col gap-2 p-3 sm:gap-2.5 sm:p-3.5">
              <Link
                href={bookmark.content.assetUrl}
                target="_blank"
                rel="noreferrer"
                className="ease-(--ease-out) line-clamp-2 overflow-hidden text-ellipsis break-words text-base font-semibold leading-snug tracking-tight transition-colors duration-150 hover:text-primary sm:text-lg"
              >
                {bookmark.title || "Untitled"}
              </Link>
              <BookmarkDetails bookmark={bookmark} />
            </div>
          </>
        );
    }
  };

  return (
    <Card className="shadow-xs ease-(--ease-out) mb-2 overflow-hidden rounded-2xl border border-border/80 bg-card transition-[border-color,box-shadow,background-color] duration-200 hover:border-border hover:shadow-md sm:mb-4">
      {renderContent()}
    </Card>
  );
}

function getBreakpointConfig() {
  const breakpointColumnsObj: { [key: number]: number; default: number } = {
    default: 3,
  };
  breakpointColumnsObj[SCREENS.lg] = 2;
  breakpointColumnsObj[SCREENS.md] = 2;
  breakpointColumnsObj[SCREENS.sm] = 2;
  return breakpointColumnsObj;
}

export default function PublicBookmarkGrid({
  bookmarks: initialBookmarks,
  nextCursor,
  list,
}: {
  list: {
    id: string;
    name: string;
    description: string | null | undefined;
    icon: string;
    numItems: number;
    ownerName: string;
    ownerImage: string | null;
  };
  bookmarks: ZPublicBookmark[];
  nextCursor: ZCursor | null;
}) {
  const api = useTRPC();
  const { ref: loadMoreRef, inView: loadMoreButtonInView } = useInView();
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery(
      api.publicBookmarks.getPublicBookmarksInList.infiniteQueryOptions(
        { listId: list.id },
        {
          initialData: () => ({
            pages: [{ bookmarks: initialBookmarks, nextCursor, list }],
            pageParams: [null],
          }),
          initialCursor: null,
          getNextPageParam: (lastPage) => lastPage.nextCursor,
          refetchOnMount: true,
        },
      ),
    );

  useEffect(() => {
    if (loadMoreButtonInView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, loadMoreButtonInView]);

  const breakpointConfig = useMemo(() => getBreakpointConfig(), []);

  const bookmarks = useMemo(() => {
    return data.pages.flatMap((b) => b.bookmarks);
  }, [data]);

  return (
    <>
      <Masonry
        className="-ml-2 flex w-auto sm:-ml-4"
        columnClassName="pl-2 sm:pl-4"
        breakpointCols={breakpointConfig}
      >
        {bookmarks.map((bookmark) => (
          <BookmarkCard key={bookmark.id} bookmark={bookmark} />
        ))}
      </Masonry>
      {hasNextPage && (
        <div className="flex justify-center">
          <ActionButton
            ref={loadMoreRef}
            ignoreDemoMode={true}
            loading={isFetchingNextPage}
            onClick={() => fetchNextPage()}
            variant="ghost"
          >
            Load More
          </ActionButton>
        </div>
      )}
    </>
  );
}
