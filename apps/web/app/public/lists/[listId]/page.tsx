import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EmptyState } from "@/components/shared/EmptyState";
import PublicBookmarkGrid from "@/components/public/lists/PublicBookmarkGrid";
import PublicListHeader from "@/components/public/lists/PublicListHeader";
import { BookmarkIcon } from "lucide-react";
import { api } from "@/server/api/client";
import { TRPCError } from "@trpc/server";

export async function generateMetadata(props: {
  params: Promise<{ listId: string }>;
}): Promise<Metadata> {
  const params = await props.params;
  try {
    const resp = await api.publicBookmarks.getPublicListMetadata({
      listId: params.listId,
    });
    return {
      title: `${resp.name} by ${resp.ownerName} - Marka`,
      description:
        resp.description && resp.description.length > 0
          ? `${resp.description} by ${resp.ownerName} on Marka`
          : undefined,
      applicationName: "Marka",
      authors: [
        {
          name: resp.ownerName,
        },
      ],
    };
  } catch (e) {
    if (e instanceof TRPCError && e.code === "NOT_FOUND") {
      notFound();
    }
  }
  return {
    title: "Marka",
  };
}

export default async function PublicListPage(props: {
  params: Promise<{ listId: string }>;
}) {
  const params = await props.params;
  try {
    const { list, bookmarks, nextCursor } =
      await api.publicBookmarks.getPublicBookmarksInList({
        listId: params.listId,
      });
    const publicList = {
      id: params.listId,
      name: list.name,
      description: list.description,
      icon: list.icon,
      numItems: list.numItems,
      ownerName: list.ownerName,
      ownerImage: list.ownerImage,
    };

    return (
      <div className="mx-auto w-full space-y-4 sm:space-y-5">
        <PublicListHeader list={publicList} />
        {list.numItems > 0 ? (
          <PublicBookmarkGrid
            list={publicList}
            bookmarks={bookmarks}
            nextCursor={nextCursor}
          />
        ) : (
          <EmptyState
            icon={<BookmarkIcon className="size-7" />}
            title="This public list is empty"
            description="The list has been shared, but it does not have any bookmarks in it yet."
            className="rounded-2xl border-border/80 bg-card"
          />
        )}
      </div>
    );
  } catch (e) {
    if (e instanceof TRPCError && e.code === "NOT_FOUND") {
      notFound();
    }
  }
}
