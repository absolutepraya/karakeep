import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  ResponsiveDialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useTranslation } from "@/lib/i18n/client";

import type { ZBookmark } from "@karakeep/shared/types/bookmarks";

import { BookmarkTagsEditor } from "./BookmarkTagsEditor";

export default function TagModal({
  bookmark,
  open,
  setOpen,
}: {
  bookmark: ZBookmark;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <ResponsiveDialogContent className="gap-0 p-0">
        <DialogHeader className="border-b border-border/70 px-5 pb-4 pt-6 text-left sm:px-6">
          <DialogTitle className="text-xl font-semibold tracking-tight">
            {t("actions.edit_tags")}
          </DialogTitle>
        </DialogHeader>
        <div className="px-5 py-4 sm:px-6 sm:py-5">
          <BookmarkTagsEditor bookmark={bookmark} />
        </div>
        <div className="sticky bottom-0 border-t border-border/70 bg-card px-5 py-4 sm:px-6">
          <DialogClose asChild>
            <Button type="button" variant="secondary" className="h-11 w-full">
              {t("actions.close")}
            </Button>
          </DialogClose>
        </div>
      </ResponsiveDialogContent>
    </Dialog>
  );
}

export function useTagModel(bookmark: ZBookmark) {
  const [open, setOpen] = useState(false);

  return {
    open,
    setOpen,
    content: (
      <TagModal
        key={bookmark.id}
        bookmark={bookmark}
        open={open}
        setOpen={setOpen}
      />
    ),
  };
}
