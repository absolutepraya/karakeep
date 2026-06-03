"use client";

import { ActionButton } from "@/components/ui/action-button";
import { useTranslation } from "@/lib/i18n/client";
import { AlertCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import type { ZBookmark } from "@karakeep/shared/types/bookmarks";
import { useRecrawlBookmark } from "@karakeep/shared-react/hooks/bookmarks";

import { BookmarkLayoutAdaptingCard } from "./BookmarkLayoutAdaptingCard";

export default function UnknownCard({
  bookmark,
  className,
  bookmarkIndex,
}: {
  bookmark: ZBookmark;
  className?: string;
  bookmarkIndex?: number;
}) {
  const { t } = useTranslation();
  const { mutate: recrawl, isPending } = useRecrawlBookmark({
    onSuccess: () => toast.success(t("toasts.bookmarks.refetch")),
    onError: () => toast.error(t("common.something_went_wrong")),
  });
  return (
    <BookmarkLayoutAdaptingCard
      title={bookmark.title}
      bookmark={bookmark}
      className={className}
      bookmarkIndex={bookmarkIndex}
      wrapTags={false}
      image={(_layout) => (
        <div className="flex size-full flex-1 flex-col items-center justify-center gap-3 bg-destructive/5 p-4 text-center">
          <AlertCircle className="size-10 text-destructive" />
          <h3 className="font-semibold text-destructive">
            {t("common.something_went_wrong")}
          </h3>
          <ActionButton
            variant="outline"
            size="sm"
            loading={isPending}
            className="gap-2"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              recrawl({ bookmarkId: bookmark.id });
            }}
          >
            <RefreshCw className="size-4" />
            {t("actions.recrawl")}
          </ActionButton>
        </div>
      )}
    />
  );
}
