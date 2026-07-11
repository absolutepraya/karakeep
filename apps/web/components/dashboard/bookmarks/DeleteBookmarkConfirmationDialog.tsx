import { usePathname, useRouter } from "next/navigation";
import { ActionButton } from "@/components/ui/action-button";
import ActionConfirmingDialog from "@/components/ui/action-confirming-dialog";
import { useTranslation } from "@/lib/i18n/client";
import { useUndoableBookmarkDeletion } from "@/lib/hooks/useUndoableBookmarkDeletion";

import type { ZBookmark } from "@karakeep/shared/types/bookmarks";

export default function DeleteBookmarkConfirmationDialog({
  bookmark,
  children,
  open,
  setOpen,
}: {
  bookmark: ZBookmark;
  children?: React.ReactNode;
  open: boolean;
  setOpen: (v: boolean) => void;
}) {
  const { t } = useTranslation();
  const currentPath = usePathname();
  const router = useRouter();

  const { scheduleDelete, pendingBookmarkIds } = useUndoableBookmarkDeletion();

  return (
    <ActionConfirmingDialog
      open={open}
      setOpen={setOpen}
      title={t("dialogs.bookmarks.delete_confirmation_title")}
      description={t("dialogs.bookmarks.delete_confirmation_description")}
      actionButton={() => (
        <ActionButton
          type="button"
          variant="destructive"
          loading={pendingBookmarkIds.includes(bookmark.id)}
          onClick={() => {
            scheduleDelete(bookmark.id);
            setOpen(false);
            if (currentPath.includes(bookmark.id)) {
              router.push("/dashboard/bookmarks");
            }
          }}
        >
          Delete
        </ActionButton>
      )}
    >
      {children}
    </ActionConfirmingDialog>
  );
}
