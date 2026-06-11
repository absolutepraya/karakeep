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

  const actionButtonClass =
    "flex size-8 items-center justify-center rounded-full text-muted-foreground transition-[transform,background-color,color,opacity] duration-150 ease-(--ease-out) hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97]";

  return (
    <div className="pointer-coarse:opacity-100 ease-(--ease-out) pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100 pointer-fine:group-focus-within:opacity-100 flex items-center gap-0.5 text-muted-foreground transition-opacity duration-150">
      {canFavourite ? (
        <button
          type="button"
          aria-label={favLabel}
          title={favLabel}
          className={actionButtonClass}
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
          <div className="flex size-8 items-center justify-center rounded-full text-muted-foreground/80">
            <FavouritedActionIcon favourited size={16} />
          </div>
        )
      )}
      <Link
        href={`/dashboard/preview/${bookmark.id}`}
        aria-label={t("actions.expand")}
        className={cn(
          buttonVariants({ variant: "ghost", size: "icon-sm" }),
          "ease-(--ease-out) rounded-full text-muted-foreground transition-[transform,background-color,color] duration-150 hover:text-foreground active:scale-[0.97]",
        )}
      >
        <Maximize2 size={16} />
      </Link>
      <BookmarkOptions bookmark={bookmark} />
    </div>
  );
}
