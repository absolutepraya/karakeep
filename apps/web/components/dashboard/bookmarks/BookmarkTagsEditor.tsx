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
        onAttach={({ tagName, tagId }) => {
          void updateTags
            .mutateAsync({
              bookmarkId: bookmark.id,
              attach: [{ tagName, tagId }],
              detach: [],
            })
            .then(notifyTagSave)
            .catch(notifyTagSaveError);
        }}
        onDetach={({ tagId }) => {
          void updateTags
            .mutateAsync({
              bookmarkId: bookmark.id,
              attach: [],
              detach: [{ tagId }],
            })
            .then(notifyTagSave)
            .catch(notifyTagSaveError);
        }}
      />
    </div>
  );
}
