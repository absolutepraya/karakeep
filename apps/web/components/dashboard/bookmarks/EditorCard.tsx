import type { SubmitErrorHandler, SubmitHandler } from "react-hook-form";
import React, { useImperativeHandle, useMemo, useRef, useState } from "react";
import { BookmarkListSelector } from "@/components/dashboard/lists/BookmarkListSelector";
import { ActionButton } from "@/components/ui/action-button";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormItem } from "@/components/ui/form";
import { Kbd } from "@/components/ui/kbd";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/components/ui/sonner";
import { Textarea } from "@/components/ui/textarea";
import BookmarkAlreadyExistsToast from "@/components/utils/BookmarkAlreadyExistsToast";
import { useClientConfig } from "@/lib/clientConfig";
import { useTranslation } from "@/lib/i18n/client";
import {
  useBookmarkLayout,
  useBookmarkLayoutSwitch,
} from "@/lib/userLocalSettings/bookmarksLayout";
import { cn, getOS } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import { X } from "lucide-react";
import { useForm } from "react-hook-form";
import { useHotkeys } from "react-hotkeys-hook";
import { z } from "zod";

import { useCreateBookmarkWithPostHook } from "@karakeep/shared-react/hooks/bookmarks";
import { useAddBookmarkToList } from "@karakeep/shared-react/hooks/lists";
import { BookmarkTypes } from "@karakeep/shared/types/bookmarks";

import { useUploadAsset } from "../UploadDropzone";

/**
 * Returns the per-line URL strings if every non-empty line is a valid http(s)
 * URL (and there's at least one), otherwise null. Used both to decide the
 * Save/Import label live and to import each line as its own link bookmark.
 */
function parseImportableUrls(text: string): string[] | null {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length === 0) {
    return null;
  }
  const urls: string[] = [];
  for (const line of lines) {
    let parsed: URL;
    try {
      parsed = new URL(line);
    } catch {
      return null;
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    urls.push(line);
  }
  return urls;
}

export default function EditorCard({
  className,
  onCreated,
}: {
  className?: string;
  onCreated?: () => void;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const demoMode = !!useClientConfig().demoMode;
  const bookmarkLayout = useBookmarkLayout();
  const formSchema = z.object({
    text: z.string(),
  });
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      text: "",
    },
  });
  const { ref, ...textFieldProps } = form.register("text");
  useImperativeHandle(ref, () => inputRef.current);
  useHotkeys("mod+e", () => {
    inputRef.current?.focus();
  });

  // Optional destination folder for newly created bookmarks. Defaults to null
  // (no folder / home). A ref mirrors the state so the create-success handler
  // always reads the current selection, even when a multi-URL paste fires many
  // creations in a row.
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const selectedListIdRef = useRef<string | null>(null);
  const updateSelectedList = (listId: string | null) => {
    setSelectedListId(listId);
    selectedListIdRef.current = listId;
  };

  const { mutateAsync: addToList } = useAddBookmarkToList({
    onError: () => {
      toast({
        description: t("common.something_went_wrong"),
        variant: "destructive",
      });
    },
  });

  const { mutate, isPending } = useCreateBookmarkWithPostHook({
    onSuccess: (resp) => {
      if (resp.alreadyExists) {
        toast({
          description: <BookmarkAlreadyExistsToast bookmarkId={resp.id} />,
          variant: "default",
        });
      }
      // File the new bookmark into the chosen folder, if any.
      if (selectedListIdRef.current) {
        void addToList({
          bookmarkId: resp.id,
          listId: selectedListIdRef.current,
        });
      }
      form.reset();
      // if the list layout is used, we reset the size of the editor card to the original size after submitting
      if (bookmarkLayout === "list" && inputRef?.current?.style) {
        inputRef.current.style.height = "auto";
      }
      onCreated?.();
    },
    onError: (e) => {
      toast({ description: e.message, variant: "destructive" });
    },
  });

  const uploadAsset = useUploadAsset();

  const onInput = (e: React.FormEvent<HTMLTextAreaElement>) => {
    // Expand the textarea to a max of half the screen size in the list layout only
    if (bookmarkLayout === "list") {
      const target = e.target as HTMLTextAreaElement;
      const maxHeight = window.innerHeight * 0.5;
      target.style.height = "auto";

      if (target.scrollHeight <= maxHeight) {
        target.style.height = `${target.scrollHeight}px`;
      } else {
        target.style.height = `${maxHeight}px`;
      }
    }
  };

  const onSubmit: SubmitHandler<z.infer<typeof formSchema>> = (data) => {
    const text = data.text.trim();
    if (!text.length) return;
    const urls = parseImportableUrls(text);
    if (urls && urls.length > 0) {
      // Every line is a URL --> import each as its own link bookmark, no prompt.
      urls.forEach((url) => mutate({ type: BookmarkTypes.LINK, url }));
    } else {
      mutate({ type: BookmarkTypes.TEXT, text });
    }
  };

  const onError: SubmitErrorHandler<z.infer<typeof formSchema>> = (errors) => {
    toast({
      description: Object.values(errors)
        .map((v) => v.message)
        .join("\n"),
      variant: "destructive",
    });
  };
  const cardHeight = useBookmarkLayoutSwitch({
    grid: "h-96",
    // A touch taller than the old h-48 so the destination-folder row and the
    // Save button both fit inside the compact masonry card.
    masonry: "h-60",
    list: undefined,
    compact: undefined,
  });

  const handlePaste = async (
    event: React.ClipboardEvent<HTMLTextAreaElement>,
  ) => {
    if (event?.clipboardData?.items) {
      await Promise.all(
        Array.from(event.clipboardData.items)
          .filter((item) => item?.type?.startsWith("image"))
          .map((item) => {
            const blob = item.getAsFile();
            if (blob) {
              return uploadAsset(blob);
            }
          }),
      );
    }
  };

  /**
   * Methods that triggers when "enter" is pressed (without ctrl)
   * It checks if the current line is a todo
   * if it is it automatically appends a todo a the start of the new line
   */
  const handleNewTodo = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const todoMarkup = "- [ ] ";
    const textarea = inputRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const textBefore = textarea.value.slice(0, start);
    const lines = textBefore.split("\n");
    const currentLine = lines[lines.length - 1];
    const currentLineIsTodo = currentLine.startsWith(todoMarkup);
    if (!currentLineIsTodo) return;
    e.preventDefault();
    const newValue =
      textarea.value.slice(0, start) +
      "\n" +
      todoMarkup +
      textarea.value.slice(end);
    form.setValue("text", newValue, { shouldDirty: true, shouldTouch: true });
    textarea.value = newValue;
    textarea.selectionStart = start + todoMarkup.length + 1;
    textarea.selectionEnd = start + todoMarkup.length + 1;
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  };

  const OS = getOS();

  // Live-detect whether the textarea holds multiple URLs so the button can
  // switch from "Save" to "Import N bookmarks".
  const textValue = form.watch("text");
  const importUrls = useMemo(
    () => parseImportableUrls(textValue.trim()),
    [textValue],
  );
  const isMultiImport = (importUrls?.length ?? 0) > 1;

  return (
    <Form {...form}>
      <form
        className={cn(
          className,
          "relative flex flex-col gap-2 rounded-xl bg-card p-4 transition-shadow focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/30",
          cardHeight,
        )}
        onSubmit={form.handleSubmit(onSubmit, onError)}
      >
        <div className="flex justify-between">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {t("editor.new_item")}
          </p>
          <Kbd>⌘ + E</Kbd>
        </div>
        <Separator />
        <FormItem className="min-h-0 flex-1">
          <FormControl>
            <Textarea
              ref={inputRef}
              disabled={isPending}
              className={cn(
                "h-full w-full border-none bg-transparent p-0 text-base placeholder:text-muted-foreground/70 focus-visible:ring-0 focus-visible:ring-offset-0",
                { "resize-none": bookmarkLayout !== "list" },
              )}
              placeholder={t("editor.placeholder_v2")}
              onKeyDown={(e) => {
                if (demoMode) {
                  return;
                }
                if (
                  e.key === "Enter" &&
                  !(e.metaKey || e.ctrlKey || e.shiftKey)
                ) {
                  handleNewTodo(e);
                }
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  form.handleSubmit(onSubmit, onError)();
                }
              }}
              onPaste={(e) => {
                if (demoMode) {
                  return;
                }
                handlePaste(e);
              }}
              onInput={onInput}
              {...textFieldProps}
            />
          </FormControl>
        </FormItem>
        {/* Optional destination folder, sitting right above Save. Empty by
            default, in which case new bookmarks land in no folder (home). */}
        <div className="flex items-center gap-2">
          <BookmarkListSelector
            value={selectedListId}
            onChange={updateSelectedList}
            listTypes={["manual"]}
            placeholder={t("actions.add_to_list")}
            disabled={isPending || demoMode}
            className="flex-1"
          />
          {selectedListId && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="shrink-0"
              aria-label={t("actions.clear", { defaultValue: "Clear" })}
              disabled={isPending}
              onClick={() => updateSelectedList(null)}
            >
              <X className="size-4" />
            </Button>
          )}
        </div>
        <ActionButton
          disabled={!form.formState.dirtyFields.text}
          loading={isPending}
          type="submit"
          variant="secondary"
        >
          {form.formState.dirtyFields.text
            ? demoMode
              ? t("editor.disabled_submissions")
              : isMultiImport
                ? t("editor.import_n_bookmarks", {
                    count: importUrls?.length ?? 0,
                  })
                : `${t("actions.save")} (${OS === "macos" ? "⌘" : "Ctrl"} + Enter)`
            : t("actions.save")}
        </ActionButton>
      </form>
    </Form>
  );
}
