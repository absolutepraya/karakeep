"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BrainCircuit,
  CheckCircle2,
  Cloud,
  CloudOff,
  FileDown,
  Globe,
  LoaderCircle,
  RefreshCw,
  Sparkles,
  Tags,
  TriangleAlert,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  useOfflineLibrary,
  useOfflineLibraryStatus,
} from "@/lib/offline-library/provider";
import { offlineLibraryDb } from "@/lib/offline-library/repository";
import { useTRPC } from "@karakeep/shared-react/trpc";
import { zBookmarkSchema } from "@karakeep/shared/types/bookmarks";
import type { ZBookmark } from "@karakeep/shared/types/bookmarks";
import type {
  ZOfflineSyncConflict,
  ZOfflineSyncMutation,
} from "@karakeep/shared/types/offlineSync";

import LibrarySyncConflictDialog from "./LibrarySyncConflictDialog";

const LABEL_BY_KIND = {
  crawling: "Crawling",
  tagging: "Tagging",
  summarizing: "Summarizing",
  embedding: "Embedding",
  importing: "Importing",
} as const;

const ICON_BY_KIND = {
  crawling: Globe,
  tagging: Tags,
  summarizing: Sparkles,
  embedding: BrainCircuit,
  importing: FileDown,
} as const;

const BOOKMARK_UPDATE_FIELDS = [
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

type BookmarkUpdateField = (typeof BOOKMARK_UPDATE_FIELDS)[number];

type StoredOfflineSyncMutation = ZOfflineSyncMutation & {
  ownerUserId: string;
  queuedAt: number;
};

function isBookmarkUpdateField(field: string): field is BookmarkUpdateField {
  return BOOKMARK_UPDATE_FIELDS.includes(field as BookmarkUpdateField);
}

function getConflictId(conflict: ZOfflineSyncConflict) {
  return `${conflict.bookmarkId}:${conflict.field}`;
}

function pendingWritesLabel(pendingWrites: number) {
  return `${pendingWrites} pending write${pendingWrites === 1 ? "" : "s"}`;
}

function lastSyncedLabel(lastSyncedAt: Date | null) {
  return lastSyncedAt
    ? `Last synced ${lastSyncedAt.toLocaleString()}`
    : "Not synced yet";
}

function updateBookmarkField(
  bookmark: ZBookmark,
  field: BookmarkUpdateField | "tags",
  value: unknown,
) {
  let updated: unknown;
  if (field === "tags") {
    if (!Array.isArray(value) || !value.every((tagId) => typeof tagId === "string")) {
      throw new TypeError("Server tags must be an array of tag IDs");
    }
    const tagsById = new Map(bookmark.tags.map((tag) => [tag.id, tag]));
    updated = {
      ...bookmark,
      tags: value.map(
        (tagId) =>
          tagsById.get(tagId) ?? {
            id: tagId,
            name: "",
            attachedBy: "human",
          },
      ),
    };
  } else if (
    field === "title" ||
    field === "archived" ||
    field === "favourited" ||
    field === "note" ||
    field === "summary"
  ) {
    updated = { ...bookmark, [field]: value };
  } else if (field === "text") {
    if (bookmark.content.type !== "text") {
      throw new TypeError("The bookmark does not have text content");
    }
    updated = {
      ...bookmark,
      content: { ...bookmark.content, text: value },
    };
  } else {
    if (bookmark.content.type !== "link") {
      throw new TypeError("The bookmark does not have link content");
    }
    updated = {
      ...bookmark,
      content: { ...bookmark.content, [field]: value },
    };
  }

  const parsed = zBookmarkSchema.safeParse(updated);
  if (!parsed.success) {
    throw new TypeError(`Server value is invalid for ${field}`);
  }
  return parsed.data;
}

async function removePendingFieldMutations(conflict: ZOfflineSyncConflict) {
  const mutations = (await offlineLibraryDb.outbox
    .where("bookmarkId")
    .equals(conflict.bookmarkId)
    .toArray()) as StoredOfflineSyncMutation[];

  await Promise.all(
    mutations.map(async (mutation) => {
      if (mutation.kind === "bookmark.tags") {
        if (conflict.field === "tags") {
          await offlineLibraryDb.outbox.delete(mutation.idempotencyKey);
        }
        return;
      }
      if (!(conflict.field in mutation.fields)) return;

      const fields = { ...mutation.fields } as Record<string, unknown>;
      const baseVersions = { ...mutation.baseVersions };
      delete fields[conflict.field];
      delete baseVersions[conflict.field];

      if (Object.keys(fields).length === 0) {
        await offlineLibraryDb.outbox.delete(mutation.idempotencyKey);
        return;
      }

      await offlineLibraryDb.outbox.put({
        ...mutation,
        idempotencyKey: crypto.randomUUID(),
        fields,
        baseVersions,
      });
      await offlineLibraryDb.outbox.delete(mutation.idempotencyKey);
    }),
  );
}

async function chooseLocalConflictValue(conflict: ZOfflineSyncConflict) {
  await offlineLibraryDb.transaction(
    "rw",
    [
      offlineLibraryDb.metadata,
      offlineLibraryDb.outbox,
      offlineLibraryDb.conflicts,
    ],
    async () => {
      const owner = await offlineLibraryDb.metadata.get("replicaOwnerUserId");
      if (!owner?.value) {
        throw new Error("Offline library has no active owner");
      }

      let mutation: ZOfflineSyncMutation;
      if (conflict.field === "tags") {
        if (
          !Array.isArray(conflict.localValue) ||
          !conflict.localValue.every((tagId) => typeof tagId === "string")
        ) {
          throw new TypeError("Offline tags must be an array of tag IDs");
        }
        mutation = {
          idempotencyKey: crypto.randomUUID(),
          kind: "bookmark.tags",
          bookmarkId: conflict.bookmarkId,
          tagIds: conflict.localValue,
          baseVersions: { tags: conflict.serverVersion },
        };
      } else {
        if (!isBookmarkUpdateField(conflict.field)) {
          throw new TypeError(`Unsupported offline field ${conflict.field}`);
        }
        mutation = {
          idempotencyKey: crypto.randomUUID(),
          kind: "bookmark.update",
          bookmarkId: conflict.bookmarkId,
          fields: { [conflict.field]: conflict.localValue },
          baseVersions: { [conflict.field]: conflict.serverVersion },
        } as ZOfflineSyncMutation;
      }

      await removePendingFieldMutations(conflict);
      await offlineLibraryDb.outbox.put({
        ...mutation,
        ownerUserId: owner.value,
        queuedAt: Date.now(),
      });
      await offlineLibraryDb.conflicts.delete(getConflictId(conflict));
    },
  );
}

async function chooseServerConflictValue(conflict: ZOfflineSyncConflict) {
  const field = conflict.field;
  if (field !== "tags" && !isBookmarkUpdateField(field)) {
    throw new TypeError(`Unsupported offline field ${field}`);
  }

  await offlineLibraryDb.transaction(
    "rw",
    [
      offlineLibraryDb.bookmarks,
      offlineLibraryDb.bookmarkFieldVersions,
      offlineLibraryDb.outbox,
      offlineLibraryDb.conflicts,
    ],
    async () => {
      const bookmark = await offlineLibraryDb.bookmarks.get(conflict.bookmarkId);
      if (!bookmark) {
        throw new Error("Offline bookmark is unavailable");
      }

      await removePendingFieldMutations(conflict);
      await offlineLibraryDb.bookmarks.put(
        updateBookmarkField(bookmark, field, conflict.serverValue),
      );
      await offlineLibraryDb.bookmarkFieldVersions.put({
        bookmarkId: conflict.bookmarkId,
        field,
        version: conflict.serverVersion,
      });
      await offlineLibraryDb.conflicts.delete(getConflictId(conflict));
    },
  );
}

export default function ProcessingStatusIndicator() {
  const api = useTRPC();
  const status = useOfflineLibraryStatus();
  const { syncNow } = useOfflineLibrary();
  const [conflicts, setConflicts] = React.useState<ZOfflineSyncConflict[]>([]);
  const [selectedConflict, setSelectedConflict] =
    React.useState<ZOfflineSyncConflict | null>(null);
  const lastSuccessfulSyncRef = React.useRef<Date | null>(null);
  const { data } = useQuery(
    api.bookmarks.getProcessingStatus.queryOptions(undefined, {
      refetchInterval: 15_000,
    }),
  );
  const serverProcessing = data ?? { total: 0, tasks: [] };

  const loadConflicts = React.useCallback(async () => {
    const records = await offlineLibraryDb.conflicts.toArray();
    setConflicts(records);
    return records;
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    if (status.kind !== "conflict") {
      setConflicts([]);
      setSelectedConflict(null);
      return;
    }

    void offlineLibraryDb.conflicts.toArray().then((records) => {
      if (!cancelled) setConflicts(records);
    });

    return () => {
      cancelled = true;
    };
  }, [status]);

  React.useEffect(() => {
    if (status.kind === "online" || status.kind === "offline") {
      lastSuccessfulSyncRef.current = status.lastSyncedAt;
    }
  }, [status]);

  let Icon = CheckCircle2;
  let libraryDetail = "Preparing offline library";
  let libraryState = "preparing";
  let isSyncing = false;
  let needsAttention = false;
  let pendingWrites = 0;

  switch (status.kind) {
    case "online":
      libraryState = "online";
      libraryDetail = lastSyncedLabel(status.lastSyncedAt);
      pendingWrites = status.pendingWrites;
      Icon = Cloud;
      break;
    case "syncing":
      libraryState = `syncing, ${status.phase}, ${status.completed} of ${status.total}`;
      libraryDetail = `${status.completed} of ${status.total} complete`;
      pendingWrites = status.pendingWrites;
      Icon = RefreshCw;
      isSyncing = true;
      break;
    case "offline":
      libraryState = "offline";
      libraryDetail = `${lastSyncedLabel(status.lastSyncedAt)}. Changes stay on this device until you reconnect.`;
      pendingWrites = status.pendingWrites;
      Icon = CloudOff;
      break;
    case "error":
      libraryState = "sync error";
      libraryDetail = `${status.message}. ${lastSyncedLabel(lastSuccessfulSyncRef.current)}`;
      pendingWrites = status.pendingWrites;
      Icon = TriangleAlert;
      needsAttention = true;
      break;
    case "conflict":
      libraryState = `${status.conflictCount} conflict${status.conflictCount === 1 ? "" : "s"}`;
      libraryDetail = "Choose which value to keep before syncing can continue.";
      pendingWrites = status.pendingWrites;
      Icon = TriangleAlert;
      needsAttention = true;
      break;
  }

  const buttonLabel = `Library activity: ${libraryState}, ${libraryDetail}${pendingWrites > 0 ? `, ${pendingWritesLabel(pendingWrites)}` : ""}${serverProcessing.total > 0 ? `, ${serverProcessing.total} background task${serverProcessing.total === 1 ? "" : "s"} processing` : ""}`;

  async function retrySync() {
    await syncNow();
  }

  async function openConflict() {
    const records = conflicts.length > 0 ? conflicts : await loadConflicts();
    setSelectedConflict(records[0] ?? null);
  }

  async function resolveWithLocalValue(conflict: ZOfflineSyncConflict) {
    await chooseLocalConflictValue(conflict);
    setConflicts((current) =>
      current.filter((currentConflict) => getConflictId(currentConflict) !== getConflictId(conflict)),
    );
    setSelectedConflict(null);
    void retrySync().catch(() => undefined);
  }

  async function resolveWithServerValue(conflict: ZOfflineSyncConflict) {
    await chooseServerConflictValue(conflict);
    setConflicts((current) =>
      current.filter((currentConflict) => getConflictId(currentConflict) !== getConflictId(conflict)),
    );
    setSelectedConflict(null);
    void retrySync().catch(() => undefined);
  }

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            className="shadow-xs ease-(--ease-out) h-10 gap-1.5 rounded-xl border border-border/70 bg-background px-2.5 text-foreground transition-[background-color,border-color,box-shadow] duration-150 hover:bg-accent/70"
            aria-label={buttonLabel}
          >
            <Icon
              className={`size-4 ${isSyncing ? "animate-spin" : ""} ${needsAttention ? "text-destructive" : "text-primary"}`}
            />
            {pendingWrites > 0 && (
              <span className="text-sm font-medium tabular-nums">{pendingWrites}</span>
            )}
            {serverProcessing.total > 0 && (
              <span className="flex items-center gap-1 text-sm font-medium tabular-nums">
                <LoaderCircle className="size-3.5 animate-spin text-primary" />
                {serverProcessing.total}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 rounded-xl p-2">
          <section aria-labelledby="library-sync-heading">
            <div className="flex items-center gap-2 px-2 py-1">
              <Icon
                className={`size-4 ${isSyncing ? "animate-spin" : ""} ${needsAttention ? "text-destructive" : "text-primary"}`}
              />
              <p id="library-sync-heading" className="text-sm font-medium">
                Library sync
              </p>
            </div>
            <div className="space-y-2 px-2 py-2 text-sm text-muted-foreground">
              <p>{libraryDetail}</p>
              {status.kind === "syncing" && (
                <p>Current phase: {status.phase}</p>
              )}
              {pendingWrites > 0 && <p>{pendingWritesLabel(pendingWrites)}</p>}
              {status.kind === "error" && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void retrySync().catch(() => undefined)}
                >
                  Retry sync
                </Button>
              )}
              {status.kind === "offline" && pendingWrites > 0 && (
                <p>Queued changes will sync automatically when you reconnect.</p>
              )}
              {status.kind === "conflict" && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void openConflict()}
                >
                  Resolve {status.conflictCount} conflict
                  {status.conflictCount === 1 ? "" : "s"}
                </Button>
              )}
            </div>
          </section>

          {serverProcessing.total > 0 && (
            <section
              aria-labelledby="background-processing-heading"
              className="mt-2 border-t border-border/70 pt-2"
            >
              <div className="flex items-center gap-2 px-2 py-1">
                <LoaderCircle className="size-4 animate-spin text-primary" />
                <p id="background-processing-heading" className="text-sm font-medium">
                  Background processing
                </p>
                <span className="ml-auto text-sm font-medium tabular-nums">
                  {serverProcessing.total}
                </span>
              </div>
              <div className="mt-1 space-y-0.5">
                {serverProcessing.tasks.map((task) => {
                  const TaskIcon = ICON_BY_KIND[task.kind];
                  return (
                    <div
                      key={task.kind}
                      className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm"
                    >
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <TaskIcon className="size-3.5" />
                        {LABEL_BY_KIND[task.kind]}
                      </span>
                      <span className="font-medium tabular-nums">{task.count}</span>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </PopoverContent>
      </Popover>
      <LibrarySyncConflictDialog
        conflict={selectedConflict}
        onChooseLocal={resolveWithLocalValue}
        onChooseServer={resolveWithServerValue}
      />
    </>
  );
}
