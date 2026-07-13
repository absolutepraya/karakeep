import { toast } from "@/components/ui/sonner";
import {
  isOfflineQueuedMutation,
  useOfflineSafeBookmarkTags,
} from "@/lib/hooks/useOfflineSafeBookmarkMutation";
import { useOfflineLibraryStatus } from "@/lib/offline-library/provider";

import type { ZBookmark } from "@karakeep/shared/types/bookmarks";

import { TagsEditor } from "./TagsEditor";

export function BookmarkTagsEditor({
  bookmark,
  disabled,
}: {
  bookmark: ZBookmark;
  disabled?: boolean;
}) {
  const offlineStatus = useOfflineLibraryStatus();
  const requiresOnline = offlineStatus.kind !== "online";
  const updateTags = useOfflineSafeBookmarkTags();

  const notifyTagSave = (result: unknown) => {
    toast({
      description: isOfflineQueuedMutation(result)
        ? "Saved offline, will sync when connected"
        : "Tags has been updated!",
    });
  };

  const notifyTagSaveError = (error: unknown) => {
    toast({
      variant: "destructive",
      title: "Something went wrong",
      description:
        error instanceof Error
          ? error.message
          : "There was a problem with your request.",
    });
  };

  return (
    <div>
      {requiresOnline && (
        <p className="text-sm text-muted-foreground" role="status">
          Creating tags requires an internet connection.
        </p>
      )}
      <TagsEditor
        tags={bookmark.tags}
        disabled={disabled}
        allowCreation={!requiresOnline}
        onAttach={async ({ tagName, tagId }) => {
          try {
            const result = await updateTags.mutateAsync({
              bookmarkId: bookmark.id,
              attach: [{ tagName, tagId }],
              detach: [],
            });
            notifyTagSave(result);
          } catch (error) {
            notifyTagSaveError(error);
            throw error;
          }
        }}
        onDetach={async ({ tagId }) => {
          try {
            const result = await updateTags.mutateAsync({
              bookmarkId: bookmark.id,
              attach: [],
              detach: [{ tagId }],
            });
            notifyTagSave(result);
          } catch (error) {
            notifyTagSaveError(error);
            throw error;
          }
        }}
      />
    </div>
  );
}
