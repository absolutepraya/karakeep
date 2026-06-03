"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { useSession } from "@/lib/auth/client";
import useBulkActionsStore from "@/lib/bulkActions";
import { useClientConfig } from "@/lib/clientConfig";
import { useTranslation } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { Maximize2 } from "lucide-react";
import { toast } from "sonner";

import type { ZBookmark } from "@karakeep/shared/types/bookmarks";
import { useUpdateBookmark } from "@karakeep/shared-react/hooks/bookmarks";

import BookmarkOptions from "./BookmarkOptions";
import { FavouritedActionIcon } from "./icons";

export default function BookmarkActionBar({
  bookmark,
}: {
  bookmark: ZBookmark;
}) {
  const { t } = useTranslation();
  const { data: session } = useSession();
  const { isBulkEditEnabled } = useBulkActionsStore();
  const demoMode = !!useClientConfig().demoMode;
  const isOwner = session?.user?.id === bookmark.userId;
  const canFavourite = isOwner && !demoMode && !isBulkEditEnabled;

  const updateBookmark = useUpdateBookmark({
    onSuccess: () => toast.success(t("toasts.bookmarks.updated")),
    onError: () => toast.error(t("common.something_went_wrong")),
  });

  const favLabel = bookmark.favourited
    ? t("actions.unfavorite")
    : t("actions.favorite");

  return (
    <div className="flex items-center text-muted-foreground">
      {canFavourite ? (
        <button
          type="button"
          aria-label={favLabel}
          title={favLabel}
          className="flex size-8 items-center justify-center rounded p-1 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            updateBookmark.mutate({
              bookmarkId: bookmark.id,
              favourited: !bookmark.favourited,
            });
          }}
        >
          <FavouritedActionIcon favourited={bookmark.favourited} size={16} />
        </button>
      ) : (
        bookmark.favourited && (
          <FavouritedActionIcon className="m-1 size-8 rounded p-1" favourited />
        )
      )}
      <Link
        href={`/dashboard/preview/${bookmark.id}`}
        aria-label={t("actions.expand")}
        className={cn(buttonVariants({ variant: "ghost", size: "icon-sm" }))}
      >
        <Maximize2 size={16} />
      </Link>
      <BookmarkOptions bookmark={bookmark} />
    </div>
  );
}
