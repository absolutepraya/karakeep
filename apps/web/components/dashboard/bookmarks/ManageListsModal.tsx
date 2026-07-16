import { useState } from "react";
import { ActionButton } from "@/components/ui/action-button";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import LoadingSpinner from "@/components/ui/spinner";
import { useTranslation } from "@/lib/i18n/client";
import { useQuery } from "@tanstack/react-query";
import { Archive, X } from "lucide-react";

import {
  useAddBookmarkToList,
  useBookmarkLists,
  useRemoveBookmarkFromList,
} from "@karakeep/shared-react/hooks/lists";
import { useTRPC } from "@karakeep/shared-react/trpc";

import { BookmarkListSelector } from "../lists/BookmarkListSelector";
import { truncateListPath } from "../lists/listPath";
import ArchiveBookmarkButton from "./action-buttons/ArchiveBookmarkButton";

export default function ManageListsModal({
  bookmarkId,
  open,
  setOpen,
}: {
  bookmarkId: string;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const api = useTRPC();
  const { t } = useTranslation();

  const { data: allLists, isPending: isAllListsPending } = useBookmarkLists(
    undefined,
    { enabled: open },
  );

  const { data: alreadyInList, isPending: isAlreadyInListPending } = useQuery(
    api.lists.getListsOfBookmark.queryOptions(
      {
        bookmarkId,
      },
      { enabled: open },
    ),
  );

  const isLoading = isAllListsPending || isAlreadyInListPending;

  const { mutate: addToList, isPending: isAddingToListPending } =
    useAddBookmarkToList({
      onSuccess: () => {
        toast({
          description: t("toasts.lists.updated"),
        });
      },
      onError: (e) => {
        if (e.data?.code == "BAD_REQUEST") {
          toast({
            variant: "destructive",
            description: e.message,
          });
        } else {
          toast({
            variant: "destructive",
            title: t("common.something_went_wrong"),
          });
        }
      },
    });

  const { mutate: deleteFromList, isPending: isDeleteFromListPending } =
    useRemoveBookmarkFromList({
      onSuccess: () => {
        toast({
          description: t("toasts.lists.updated"),
        });
      },
      onError: (e) => {
        if (e.data?.code == "BAD_REQUEST") {
          toast({
            variant: "destructive",
            description: e.message,
          });
        } else {
          toast({
            variant: "destructive",
            title: t("common.something_went_wrong"),
          });
        }
      },
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="dialog-vv-bottom left-0 top-auto w-full max-w-none translate-x-0 translate-y-0 gap-0 overflow-y-auto rounded-t-[1.75rem] border-x-0 border-b-0 bg-card p-0 shadow-2xl sm:bottom-auto sm:left-[50%] sm:top-[calc(var(--vvo)+var(--vvh)/2)] sm:max-h-[calc(var(--vvh)-2rem)] sm:max-w-md sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-2xl sm:border">
        <DialogHeader className="border-b border-border/70 px-5 pb-4 pt-6 text-left sm:px-6">
          <DialogTitle className="text-xl font-semibold tracking-tight">
            {t("actions.manage_lists")}
          </DialogTitle>
          <DialogDescription>
            Add this bookmark to lists or remove existing memberships.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <LoadingSpinner className="my-12" />
        ) : (
          <div className="space-y-5 px-4 py-4 sm:px-6 sm:py-5">
            <section className="space-y-2">
              <div className="flex items-baseline justify-between px-1">
                <h3 className="text-sm font-medium">Current lists</h3>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {alreadyInList?.lists.length ?? 0}
                </span>
              </div>
              {alreadyInList?.lists.length ? (
                <ul className="space-y-1.5">
                  {alreadyInList.lists.map((list) => {
                    const path = allLists?.getPathById(list.id);
                    const fullPath = path
                      ?.map((item) => `${item.icon} ${item.name}`)
                      .join(" / ");
                    return (
                      <li
                        key={list.id}
                        className="flex min-w-0 items-center gap-2 rounded-xl border border-border/70 bg-muted/25 px-3 py-2"
                      >
                        <p
                          className="min-w-0 flex-1 truncate text-sm text-foreground"
                          title={fullPath}
                        >
                          {path ? truncateListPath(path) : list.name}
                        </p>
                        <ActionButton
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="size-9 shrink-0 rounded-lg"
                          loading={isDeleteFromListPending}
                          onClick={() =>
                            deleteFromList({ bookmarkId, listId: list.id })
                          }
                          aria-label={t("actions.remove_from_list")}
                        >
                          <X className="size-4" />
                        </ActionButton>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="rounded-xl border border-dashed border-border/80 px-3 py-4 text-sm text-muted-foreground">
                  This bookmark is not in a list yet.
                </p>
              )}
            </section>

            <section className="space-y-2 rounded-xl border border-border/70 bg-muted/20 p-3">
              <div>
                <h3 className="text-sm font-medium">Add to a list</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Choose a destination to add this bookmark immediately.
                </p>
              </div>
              <BookmarkListSelector
                hideBookmarkIds={alreadyInList?.lists.map((l) => l.id)}
                onChange={(listId) => {
                  if (!isAddingToListPending) {
                    addToList({
                      bookmarkId,
                      listId,
                    });
                  }
                }}
                listTypes={["manual"]}
                disabled={isAddingToListPending}
                className="h-10 sm:h-11"
              />
            </section>
          </div>
        )}

        <div className="sticky bottom-0 flex gap-2 border-t border-border/70 bg-card px-5 py-4 sm:px-6">
          <DialogClose asChild>
            <Button type="button" variant="secondary" className="h-11 flex-1">
              {t("actions.close")}
            </Button>
          </DialogClose>
          <ArchiveBookmarkButton
            type="button"
            bookmarkId={bookmarkId}
            onDone={() => setOpen(false)}
            variant="secondary"
            className="h-11 flex-1"
          >
            <Archive className="mr-2 size-4" /> {t("actions.archive")}
          </ArchiveBookmarkButton>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function useManageListsModal(bookmarkId: string) {
  const [open, setOpen] = useState(false);

  return {
    open,
    setOpen,
    content: open && (
      <ManageListsModal bookmarkId={bookmarkId} open={open} setOpen={setOpen} />
    ),
  };
}
