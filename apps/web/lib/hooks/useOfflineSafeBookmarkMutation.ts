"use client";

import { useCallback, useState } from "react";

import type {
  ZBookmark,
  ZUpdateBookmarksRequest,
} from "@karakeep/shared/types/bookmarks";
import type { ZOfflineSyncMutation } from "@karakeep/shared/types/offlineSync";
import {
  useUpdateBookmark,
  useUpdateBookmarkTags,
} from "@karakeep/shared-react/hooks/bookmarks";

import { useOfflineLibrary } from "@/lib/offline-library/provider";
import {
  getBookmarkFieldVersion,
  offlineLibraryDb,
} from "@/lib/offline-library/repository";

const OFFLINE_UPDATE_FIELDS = [
  "title",
  "archived",
  "favourited",
  "note",
  "summary",
  "url",
  "description",
  "author",
  "publisher",
  "text",
] as const;

type OfflineUpdateField = (typeof OFFLINE_UPDATE_FIELDS)[number];

const OFFLINE_UPDATE_FIELD_SET: Record<OfflineUpdateField, true> = {
  title: true,
  archived: true,
  favourited: true,
  note: true,
  summary: true,
  url: true,
  description: true,
  author: true,
  publisher: true,
  text: true,
};
type OfflineUpdateFields = Extract<
  ZOfflineSyncMutation,
  { kind: "bookmark.update" }
>["fields"];
interface BookmarkTagInput {
  tagId?: string;
  tagName?: string;
  attachedBy?: "human" | "ai";
}

export interface OfflineSafeBookmarkTagsInput {
  bookmarkId: string;
  attach: BookmarkTagInput[];
  detach: BookmarkTagInput[];
}

export interface OfflineQueuedMutation {
  kind: "queued";
}

export interface OfflineSafeBookmarkMutation<TInput, TResult> {
  mutate: (input: TInput) => void;
  mutateAsync: (input: TInput) => Promise<TResult>;
  isPending: boolean;
  error: Error | null;
}

export const OFFLINE_ONLINE_REQUIRED_MESSAGE =
  "This action requires an internet connection.";

class OfflineMutationOnlineRequiredError extends Error {
  constructor(message = OFFLINE_ONLINE_REQUIRED_MESSAGE) {
    super(message);
    this.name = "OfflineMutationOnlineRequiredError";
  }
}

export function isOfflineQueuedMutation(
  result: unknown,
): result is OfflineQueuedMutation {
  return (
    typeof result === "object" &&
    result !== null &&
    "kind" in result &&
    result.kind === "queued"
  );
}

function queueMutationIdempotencyKey(): string {
  if (typeof crypto?.randomUUID !== "function") {
    throw new Error("Offline writes require a UUID-capable browser");
  }
  return crypto.randomUUID();
}

const offlineTagIntentQueues = new Map<string, Promise<void>>();

function serializeOfflineTagIntent<T>(
  bookmarkId: string,
  operation: () => Promise<T>,
): Promise<T> {
  const previous = offlineTagIntentQueues.get(bookmarkId) ?? Promise.resolve();
  const result = previous.catch(() => undefined).then(operation);
  const tail = result.then(
    () => undefined,
    () => undefined,
  );
  offlineTagIntentQueues.set(bookmarkId, tail);
  void tail.finally(() => {
    if (offlineTagIntentQueues.get(bookmarkId) === tail) {
      offlineTagIntentQueues.delete(bookmarkId);
    }
  });
  return result;
}

function getOfflineUpdateFields(
  input: ZUpdateBookmarksRequest,
): OfflineUpdateFields {
  for (const [field, value] of Object.entries(input)) {
    if (
      field !== "bookmarkId" &&
      value !== undefined &&
      !Object.hasOwn(OFFLINE_UPDATE_FIELD_SET, field)
    ) {
      throw new OfflineMutationOnlineRequiredError();
    }
  }

  return Object.fromEntries(
    OFFLINE_UPDATE_FIELDS.flatMap((field) => {
      const value = input[field];
      return value === undefined ? [] : [[field, value]];
    }),
  ) as OfflineUpdateFields;
}

async function getRequiredFieldVersions(
  bookmarkId: string,
  fields: string[],
): Promise<Record<string, number>> {
  const versions = await Promise.all(
    fields.map(
      async (field) =>
        [field, await getBookmarkFieldVersion(bookmarkId, field)] as const,
    ),
  );
  const baseVersions: Record<string, number> = {};
  for (const [field, version] of versions) {
    if (version === undefined) {
      throw new OfflineMutationOnlineRequiredError();
    }
    baseVersions[field] = version;
  }
  return baseVersions;
}

function useMutationState<TInput, TResult>(
  mutateAsync: (input: TInput) => Promise<TResult>,
  isPending: boolean,
  error: Error | null,
): OfflineSafeBookmarkMutation<TInput, TResult> {
  const mutate = useCallback(
    (input: TInput) => {
      void mutateAsync(input).catch(() => undefined);
    },
    [mutateAsync],
  );

  return { mutate, mutateAsync, isPending, error };
}

export function useOfflineSafeBookmarkUpdate(): OfflineSafeBookmarkMutation<
  ZUpdateBookmarksRequest,
  ZBookmark | OfflineQueuedMutation
> {
  const { status, queueBookmarkUpdate } = useOfflineLibrary();
  const onlineMutation = useUpdateBookmark();
  const [isOfflinePending, setIsOfflinePending] = useState(false);
  const [offlineError, setOfflineError] = useState<Error | null>(null);
  const isOnline = status.kind === "online";

  const mutateAsync = useCallback(
    async (
      input: ZUpdateBookmarksRequest,
    ): Promise<ZBookmark | OfflineQueuedMutation> => {
      if (isOnline) {
        return await onlineMutation.mutateAsync(input);
      }

      setIsOfflinePending(true);
      setOfflineError(null);
      try {
        const fields = getOfflineUpdateFields(input);
        const changedFields = Object.keys(fields);
        if (changedFields.length === 0) {
          throw new OfflineMutationOnlineRequiredError();
        }
        const baseVersions = await getRequiredFieldVersions(
          input.bookmarkId,
          changedFields,
        );
        await queueBookmarkUpdate({
          idempotencyKey: queueMutationIdempotencyKey(),
          kind: "bookmark.update",
          bookmarkId: input.bookmarkId,
          fields,
          baseVersions,
        });
        return { kind: "queued" };
      } catch (error) {
        const mutationError =
          error instanceof Error ? error : new Error("Unable to save bookmark");
        setOfflineError(mutationError);
        throw mutationError;
      } finally {
        setIsOfflinePending(false);
      }
    },
    [isOnline, onlineMutation, queueBookmarkUpdate],
  );

  return useMutationState(
    mutateAsync,
    isOnline ? onlineMutation.isPending : isOfflinePending,
    isOnline ? (onlineMutation.error as Error | null) : offlineError,
  );
}

export function useOfflineSafeBookmarkTags(): OfflineSafeBookmarkMutation<
  OfflineSafeBookmarkTagsInput,
  unknown | OfflineQueuedMutation
> {
  const { status, queueBookmarkTags } = useOfflineLibrary();
  const onlineMutation = useUpdateBookmarkTags();
  const [isOfflinePending, setIsOfflinePending] = useState(false);
  const [offlineError, setOfflineError] = useState<Error | null>(null);
  const isOnline = status.kind === "online";

  const mutateAsync = useCallback(
    async (
      input: OfflineSafeBookmarkTagsInput,
    ): Promise<unknown | OfflineQueuedMutation> => {
      if (isOnline) {
        return await onlineMutation.mutateAsync(input);
      }

      setIsOfflinePending(true);
      setOfflineError(null);
      try {
        if (input.attach.some((tag) => !tag.tagId)) {
          throw new OfflineMutationOnlineRequiredError(
            "Creating tags requires an internet connection.",
          );
        }
        if (input.detach.some((tag) => !tag.tagId)) {
          throw new OfflineMutationOnlineRequiredError();
        }

        return await serializeOfflineTagIntent(input.bookmarkId, async () => {
          const bookmark = await offlineLibraryDb.bookmarks.get(
            input.bookmarkId,
          );
          if (!bookmark) {
            throw new OfflineMutationOnlineRequiredError();
          }

          const tagIds = new Set(bookmark.tags.map((tag) => tag.id));
          for (const tag of input.detach) {
            tagIds.delete(tag.tagId!);
          }
          for (const tag of input.attach) {
            tagIds.add(tag.tagId!);
          }

          const baseVersions = await getRequiredFieldVersions(
            input.bookmarkId,
            ["tags"],
          );
          await queueBookmarkTags({
            idempotencyKey: queueMutationIdempotencyKey(),
            kind: "bookmark.tags",
            bookmarkId: input.bookmarkId,
            tagIds: [...tagIds],
            baseVersions: { tags: baseVersions.tags! },
          });
          return { kind: "queued" };
        });
      } catch (error) {
        const mutationError =
          error instanceof Error ? error : new Error("Unable to save tags");
        setOfflineError(mutationError);
        throw mutationError;
      } finally {
        setIsOfflinePending(false);
      }
    },
    [isOnline, onlineMutation, queueBookmarkTags],
  );

  return useMutationState(
    mutateAsync,
    isOnline ? onlineMutation.isPending : isOfflinePending,
    isOnline ? (onlineMutation.error as Error | null) : offlineError,
  );
}
