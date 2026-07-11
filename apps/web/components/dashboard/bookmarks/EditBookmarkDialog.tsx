import * as React from "react";
import { z } from "zod";
import { ActionButton } from "@/components/ui/action-button";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "@/components/ui/sonner";
import { Textarea } from "@/components/ui/textarea";
import { useDialogFormReset } from "@/lib/hooks/useDialogFormReset";
import { useTranslation } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useForm } from "react-hook-form";

import { useUpdateBookmark } from "@karakeep/shared-react/hooks/bookmarks";
import { useTRPC } from "@karakeep/shared-react/trpc";
import {
  BookmarkTypes,
  ZBookmark,
  zUpdateBookmarksRequestSchema,
} from "@karakeep/shared/types/bookmarks";
import { getBookmarkTitle } from "@karakeep/shared/utils/bookmarkUtils";

import { BookmarkTagsEditor } from "./BookmarkTagsEditor";

const formSchema = zUpdateBookmarksRequestSchema.extend({
  createdAt: z.date().optional(),
  datePublished: z.date().nullish(),
  dateModified: z.date().nullish(),
});
type BookmarkFormValues = z.infer<typeof formSchema>;

export function EditBookmarkDialog({
  open,
  setOpen,
  bookmark,
  children,
}: {
  bookmark: ZBookmark;
  children?: React.ReactNode;
  open: boolean;
  setOpen: (v: boolean) => void;
}) {
  const api = useTRPC();
  const { t } = useTranslation();

  const { data: assetContent, isLoading: isAssetContentLoading } = useQuery(
    api.bookmarks.getBookmark.queryOptions(
      {
        bookmarkId: bookmark.id,
        includeContent: true,
      },
      {
        enabled: open && bookmark.content.type == BookmarkTypes.ASSET,
        select: (b) =>
          b.content.type == BookmarkTypes.ASSET ? b.content.content : null,
      },
    ),
  );

  const bookmarkToDefault = (bookmark: ZBookmark): BookmarkFormValues => ({
    bookmarkId: bookmark.id,
    summary: bookmark.summary,
    note: bookmark.note === null ? undefined : bookmark.note,
    title: getBookmarkTitle(bookmark),
    createdAt: bookmark.createdAt ?? new Date(),
    // Link specific defaults (only if bookmark is a link)
    url:
      bookmark.content.type === BookmarkTypes.LINK
        ? bookmark.content.url
        : undefined,
    description:
      bookmark.content.type === BookmarkTypes.LINK
        ? (bookmark.content.description ?? "")
        : undefined,
    author:
      bookmark.content.type === BookmarkTypes.LINK
        ? (bookmark.content.author ?? "")
        : undefined,
    publisher:
      bookmark.content.type === BookmarkTypes.LINK
        ? (bookmark.content.publisher ?? "")
        : undefined,
    datePublished:
      bookmark.content.type === BookmarkTypes.LINK
        ? bookmark.content.datePublished
        : undefined,
    // Asset specific fields
    assetContent: assetContent ?? undefined,
  });

  const form = useForm<BookmarkFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: bookmarkToDefault(bookmark),
  });

  const { mutate: updateBookmarkMutate, isPending: isUpdatingBookmark } =
    useUpdateBookmark({
      onSuccess: (updatedBookmark) => {
        toast({ description: "Bookmark details updated successfully!" });
        // Close the dialog after successful detail update
        setOpen(false);
        // Reset form with potentially updated data
        form.reset(bookmarkToDefault(updatedBookmark));
      },
      onError: (error) => {
        toast({
          variant: "destructive",
          title: "Failed to update bookmark",
          description: error.message,
        });
      },
    });

  function onSubmit(values: BookmarkFormValues) {
    // Ensure optional fields that are empty strings are sent as null/undefined if appropriate
    const payload = {
      ...values,
      title: values.title ?? null,
    };
    updateBookmarkMutate(payload);
  }

  // Reset form only when dialog is initially opened to preserve unsaved changes
  // This prevents losing unsaved title edits when tags are updated, which would
  // cause the bookmark prop to change and trigger a form reset
  useDialogFormReset(open, form, bookmarkToDefault(bookmark));

  // Update assetContent field when it's loaded
  React.useEffect(() => {
    if (assetContent && bookmark.content.type === BookmarkTypes.ASSET) {
      form.setValue("assetContent", assetContent);
    }
  }, [assetContent, bookmark.content.type, form]);

  const isLink = bookmark.content.type === BookmarkTypes.LINK;
  const isAsset = bookmark.content.type === BookmarkTypes.ASSET;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {children && <DialogTrigger asChild>{children}</DialogTrigger>}
      <DialogContent className="bottom-0 left-0 top-auto max-h-[calc(var(--vvh)_*_0.75)] w-full max-w-none translate-x-0 translate-y-0 gap-0 overflow-y-auto rounded-t-[1.75rem] border-x-0 border-b-0 bg-card p-0 shadow-2xl sm:bottom-auto sm:left-[50%] sm:max-h-[calc(var(--vvh)-5rem)] sm:max-w-2xl sm:translate-x-[-50%] sm:translate-y-[-50%] sm:rounded-2xl sm:border">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader className="border-b border-border/70 px-5 pb-4 pt-6 text-left sm:px-6">
              <DialogTitle className="text-xl font-semibold tracking-tight">
                {t("bookmark_editor.title")}
              </DialogTitle>
              <DialogDescription>
                {t("bookmark_editor.subtitle")}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 px-4 py-4 sm:space-y-4 sm:px-6 sm:py-4">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("common.title")}</FormLabel>
                    <FormControl>
                      <Input
                        className="h-10 w-full sm:h-11"
                        placeholder="Bookmark title"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {isLink && (
                <FormField
                  control={form.control}
                  name="url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("common.url")}</FormLabel>
                      <FormControl>
                        <Input
                          className="h-10 w-full sm:h-11"
                          placeholder="https://example.com"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <FormField
                control={form.control}
                name="note"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("common.note")}</FormLabel>
                    <FormControl>
                      <Textarea
                        className="min-h-20 resize-y sm:min-h-24"
                        placeholder="Bookmark notes"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {isLink && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("common.description")}</FormLabel>
                        <FormControl>
                          <Textarea
                            className="min-h-20 resize-y sm:min-h-24"
                            placeholder="Bookmark description"
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="summary"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("common.summary")}</FormLabel>
                        <FormControl>
                          <Textarea
                            className="min-h-20 resize-y sm:min-h-24"
                            placeholder="Bookmark summary"
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}

              {isAsset && (
                <FormField
                  control={form.control}
                  name="assetContent"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("bookmark_editor.extracted_content")}
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          className="min-h-28 resize-y sm:min-h-36"
                          disabled={isAssetContentLoading}
                          placeholder="Extracted Content"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              <div className="space-y-4 rounded-xl border border-border/70 bg-muted/30 p-3 sm:p-4">
                {isLink && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="author"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>{t("bookmark_editor.author")}</FormLabel>
                          <FormControl>
                            <Input
                              className="h-10 w-full sm:h-11"
                              placeholder="Author name"
                              {...field}
                              value={field.value ?? ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="publisher"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>
                            {t("bookmark_editor.publisher")}
                          </FormLabel>
                          <FormControl>
                            <Input
                              className="h-10 w-full sm:h-11"
                              placeholder="Publisher name"
                              {...field}
                              value={field.value ?? ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="createdAt"
                    render={({ field }) => (
                      <FormItem className="flex flex-col">
                        <FormLabel>{t("common.created_at")}</FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  "h-10 w-full pl-3 text-left font-normal sm:h-11",
                                  !field.value && "text-muted-foreground",
                                )}
                              >
                                {field.value ? (
                                  format(field.value, "PPP")
                                ) : (
                                  <span>
                                    {t("bookmark_editor.pick_a_date")}
                                  </span>
                                )}
                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={(date) =>
                                date > new Date() ||
                                date < new Date("1900-01-01")
                              }
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {isLink && (
                    <FormField
                      control={form.control}
                      name="datePublished"
                      render={({ field }) => (
                        <FormItem className="flex flex-col">
                          <FormLabel>
                            {t("bookmark_editor.date_published")}
                          </FormLabel>
                          <Popover>
                            <PopoverTrigger asChild>
                              <FormControl>
                                <Button
                                  variant="outline"
                                  className={cn(
                                    "h-10 w-full pl-3 text-left font-normal sm:h-11",
                                    !field.value && "text-muted-foreground",
                                  )}
                                >
                                  {field.value ? (
                                    format(field.value, "PPP")
                                  ) : (
                                    <span>
                                      {t("bookmark_editor.pick_a_date")}
                                    </span>
                                  )}
                                  <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                </Button>
                              </FormControl>
                            </PopoverTrigger>
                            <PopoverContent
                              className="w-auto p-0"
                              align="start"
                            >
                              <Calendar
                                mode="single"
                                selected={field.value ?? undefined}
                                onSelect={(date) =>
                                  field.onChange(date ?? null)
                                }
                                disabled={(date) =>
                                  date > new Date() ||
                                  date < new Date("1900-01-01")
                                }
                              />
                            </PopoverContent>
                          </Popover>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  )}
                </div>
              </div>

              <FormItem className="rounded-xl border border-border/70 bg-muted/30 p-3 sm:p-4">
                <FormLabel>{t("common.tags")}</FormLabel>
                <FormControl>
                  <BookmarkTagsEditor bookmark={bookmark} />
                </FormControl>
                <FormMessage />
              </FormItem>
            </div>

            <div className="sticky bottom-0 flex gap-2 border-t border-border/70 bg-card px-5 py-4 sm:px-6">
              <Button
                type="button"
                variant="secondary"
                className="h-11 flex-1"
                onClick={() => setOpen(false)}
                disabled={isUpdatingBookmark}
              >
                {t("actions.cancel")}
              </Button>
              <ActionButton
                type="submit"
                loading={isUpdatingBookmark}
                className="h-11 flex-1"
              >
                {t("bookmark_editor.save_changes")}
              </ActionButton>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
