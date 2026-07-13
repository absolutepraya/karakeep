import type {
  ZOfflineSyncMutation,
  ZOfflineSyncPullResult,
  ZOfflineSyncPushInput,
  ZOfflineSyncPushResult,
  ZOfflineSyncSnapshot,
} from "@karakeep/shared/types/offlineSync";

import {
  applyEvents,
  deleteAcknowledgedMutations,
  enqueueMutation,
  evictLeastRecentlyUsedThumbnails,
  getReplicaOwnerUserId,
  listPendingMutations,
  offlineLibraryDb,
  purgeOfflineLibrary,
  replaceSnapshot,
  saveConflict,
} from "./repository";

const RETRY_DELAYS_MS = [2_000, 10_000, 30_000, 120_000] as const;
const SYNC_CURSOR_KEY = "syncCursor";

type BookmarkUpdateMutation = Extract<
  ZOfflineSyncMutation,
  { kind: "bookmark.update" }
>;
type BookmarkTagsMutation = Extract<
  ZOfflineSyncMutation,
  { kind: "bookmark.tags" }
>;

type OfflineLibraryStatus =
  | { kind: "initializing" }
  | { kind: "online"; lastSyncedAt: Date; pendingWrites: number }
  | {
      kind: "syncing";
      phase: "pulling" | "pushing" | "thumbnails";
      completed: number;
      total: number;
      pendingWrites: number;
    }
  | { kind: "offline"; lastSyncedAt: Date | null; pendingWrites: number }
  | { kind: "error"; message: string; retryAt: Date; pendingWrites: number }
  | { kind: "conflict"; pendingWrites: number; conflictCount: number };

interface OfflineSyncClient {
  snapshot: () => Promise<ZOfflineSyncSnapshot>;
  pull: (input: { cursor: string }) => Promise<ZOfflineSyncPullResult>;
  push: (input: ZOfflineSyncPushInput) => Promise<ZOfflineSyncPushResult>;
}

type OfflineLibraryStatusListener = (status: OfflineLibraryStatus) => void;
type RetryTimer = Parameters<typeof globalThis.clearTimeout>[0];

export type {
  BookmarkTagsMutation,
  BookmarkUpdateMutation,
  OfflineLibraryStatus,
  OfflineSyncClient,
};

export class OfflineLibrarySyncCoordinator {
  private readonly listeners = new Set<OfflineLibraryStatusListener>();
  private lastSyncedAt: Date | null = null;
  private retryAttempt = 0;
  private retryTimer: RetryTimer | undefined;
  private generation = 0;
  private isActive = false;
  private userId: string | null = null;
  private runningSync: Promise<void> | null = null;
  private runningGeneration: number | null = null;
  private outboxOperation: Promise<void> = Promise.resolve();
  private status: OfflineLibraryStatus = { kind: "initializing" };

  constructor(private readonly client: OfflineSyncClient) {}

  getStatus(): OfflineLibraryStatus {
    return this.status;
  }

  subscribe(listener: OfflineLibraryStatusListener): () => void {
    this.listeners.add(listener);
    listener(this.status);
    return () => this.listeners.delete(listener);
  }

  async syncNow(): Promise<void> {
    if (!this.isActive) {
      throw new Error("Offline sync requires an authenticated user");
    }
    const generation = this.generation;
    if (this.runningSync) {
      if (this.runningGeneration === generation) {
        return await this.runningSync;
      }
      await this.runningSync;
      if (!this.isCurrentGeneration(generation)) {
        return;
      }
      return await this.syncNow();
    }

    this.clearRetry();
    this.runningGeneration = generation;
    this.runningSync = this.serializeOutboxOperation(() =>
      this.synchronize(generation),
    ).finally(() => {
      this.runningGeneration = null;
      this.runningSync = null;
    });
    return await this.runningSync;
  }

  activate(userId: string): void {
    this.generation += 1;
    this.isActive = true;
    this.userId = userId;
  }

  async deactivate(): Promise<void> {
    this.generation += 1;
    this.isActive = false;
    this.userId = null;
    this.clearRetry();
    this.setStatus({ kind: "initializing" });
    await this.runningSync;
  }

  async queueBookmarkUpdate(mutation: BookmarkUpdateMutation): Promise<void> {
    if (!this.isActive || this.userId === null) {
      throw new Error("Offline writes require an authenticated user");
    }
    const userId = this.userId;
    if (mutation.kind !== "bookmark.update") {
      throw new TypeError("Unsupported offline mutation");
    }
    await this.serializeOutboxOperation(async () => {
      await enqueueMutation(mutation, userId);
      await this.refreshDerivedStatus();
    });
  }

  async queueBookmarkTags(mutation: BookmarkTagsMutation): Promise<void> {
    if (!this.isActive || this.userId === null) {
      throw new Error("Offline writes require an authenticated user");
    }
    const userId = this.userId;
    if (mutation.kind !== "bookmark.tags") {
      throw new TypeError("Unsupported offline mutation");
    }
    await this.serializeOutboxOperation(async () => {
      await enqueueMutation(mutation, userId);
      await this.refreshDerivedStatus();
    });
  }

  async markOffline(): Promise<void> {
    this.clearRetry();
    const [pendingWrites, conflictCount] = await Promise.all([
      this.pendingWriteCount(),
      offlineLibraryDb.conflicts.count(),
    ]);
    if (conflictCount > 0) {
      this.setStatus({ kind: "conflict", pendingWrites, conflictCount });
      return;
    }
    this.setStatus({
      kind: "offline",
      lastSyncedAt: this.lastSyncedAt,
      pendingWrites,
    });
  }

  async afterThumbnailCacheWrite(): Promise<void> {
    const estimate = globalThis.navigator?.storage?.estimate;
    if (!estimate) {
      return;
    }

    while (true) {
      const { usage, quota } = await estimate.call(
        globalThis.navigator.storage,
      );
      if (
        usage === undefined ||
        quota === undefined ||
        quota <= 0 ||
        usage / quota < 0.8
      ) {
        return;
      }

      const evicted = await evictLeastRecentlyUsedThumbnails(1);
      if (evicted === 0) {
        return;
      }
    }
  }

  dispose(): void {
    this.clearRetry();
    this.listeners.clear();
  }

  private async synchronize(generation: number): Promise<void> {
    try {
      if (!this.isCurrentGeneration(generation) || this.userId === null) {
        return;
      }
      const userId = this.userId;
      let cursor = await this.getSyncCursor();
      const replicaOwnerUserId = await getReplicaOwnerUserId();
      if (!this.isCurrentGeneration(generation)) {
        return;
      }
      if (replicaOwnerUserId !== userId) {
        await purgeOfflineLibrary();
        if (!this.isCurrentGeneration(generation)) {
          return;
        }
        cursor = null;
      }
      if (cursor === null) {
        this.setStatus({
          kind: "syncing",
          phase: "pulling",
          completed: 0,
          total: 1,
          pendingWrites: await this.pendingWriteCount(),
        });
        const snapshot = await this.client.snapshot();
        if (!this.isCurrentGeneration(generation)) {
          return;
        }
        await replaceSnapshot(snapshot, userId);
      } else {
        await this.pushOutbox(generation, userId);
        if (!this.isCurrentGeneration(generation)) {
          return;
        }
        await this.pullDeltas(cursor, generation);
      }

      if (!this.isCurrentGeneration(generation)) {
        return;
      }
      this.retryAttempt = 0;
      this.lastSyncedAt = new Date();
      await this.setSettledStatus();
    } catch (error) {
      if (!this.isCurrentGeneration(generation)) {
        return;
      }
      const retryAt = new Date(Date.now() + this.nextRetryDelay());
      this.setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Offline sync failed",
        retryAt,
        pendingWrites: await this.pendingWriteCount(),
      });
      this.scheduleRetry(retryAt);
      throw error;
    }
  }

  private async pushOutbox(generation: number, userId: string): Promise<void> {
    const mutations = await listPendingMutations(userId);
    if (!this.isCurrentGeneration(generation)) {
      return;
    }
    for (let index = 0; index < mutations.length; index += 1) {
      this.setStatus({
        kind: "syncing",
        phase: "pushing",
        completed: index,
        total: mutations.length,
        pendingWrites: mutations.length - index,
      });
      const mutation = mutations[index];
      if (!mutation) {
        continue;
      }
      const result = await this.client.push({ mutations: [mutation] });
      if (!this.isCurrentGeneration(generation)) {
        return;
      }
      await Promise.all([
        deleteAcknowledgedMutations(userId, result.acknowledged),
        ...result.conflicts.map((conflict) => saveConflict(conflict)),
      ]);
      if (!this.isCurrentGeneration(generation)) {
        return;
      }
    }
  }

  private async pullDeltas(
    initialCursor: string,
    generation: number,
  ): Promise<void> {
    let cursor = initialCursor;
    let completed = 0;
    while (true) {
      this.setStatus({
        kind: "syncing",
        phase: "pulling",
        completed,
        total: completed + 1,
        pendingWrites: await this.pendingWriteCount(),
      });
      const delta = await this.client.pull({ cursor });
      if (!this.isCurrentGeneration(generation)) {
        return;
      }
      await applyEvents(delta.events, delta.cursor);
      if (!this.isCurrentGeneration(generation)) {
        return;
      }
      completed += 1;
      if (delta.events.length === 0) {
        return;
      }
      cursor = delta.cursor;
    }
  }

  private async getSyncCursor(): Promise<string | null> {
    const cursor = await offlineLibraryDb.metadata.get(SYNC_CURSOR_KEY);
    return cursor?.value ?? null;
  }

  private async setSettledStatus(): Promise<void> {
    const [pendingWrites, conflictCount] = await Promise.all([
      this.pendingWriteCount(),
      offlineLibraryDb.conflicts.count(),
    ]);
    if (conflictCount > 0) {
      this.setStatus({ kind: "conflict", pendingWrites, conflictCount });
      return;
    }
    this.setStatus({
      kind: "online",
      lastSyncedAt: this.lastSyncedAt ?? new Date(),
      pendingWrites,
    });
  }

  private async refreshDerivedStatus(): Promise<void> {
    if (this.status.kind === "initializing" || this.status.kind === "syncing") {
      return;
    }
    const [pendingWrites, conflictCount] = await Promise.all([
      this.pendingWriteCount(),
      offlineLibraryDb.conflicts.count(),
    ]);
    if (conflictCount > 0) {
      this.setStatus({ kind: "conflict", pendingWrites, conflictCount });
      return;
    }
    if (this.status.kind === "online") {
      this.setStatus({ ...this.status, pendingWrites });
      return;
    }
    if (this.status.kind === "offline") {
      this.setStatus({ ...this.status, pendingWrites });
      return;
    }
    if (this.status.kind === "error") {
      this.setStatus({ ...this.status, pendingWrites });
    }
  }

  private async serializeOutboxOperation<T>(
    operation: () => Promise<T>,
  ): Promise<T> {
    const result = this.outboxOperation.then(operation, operation);
    this.outboxOperation = result.then(
      () => undefined,
      () => undefined,
    );
    return await result;
  }

  private async pendingWriteCount(): Promise<number> {
    return this.userId === null
      ? 0
      : (await listPendingMutations(this.userId)).length;
  }

  private nextRetryDelay(): number {
    const delay =
      RETRY_DELAYS_MS[Math.min(this.retryAttempt, RETRY_DELAYS_MS.length - 1)];
    this.retryAttempt += 1;
    return delay ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
  }

  private scheduleRetry(retryAt: Date): void {
    if (
      typeof document !== "undefined" &&
      document.visibilityState !== "visible"
    ) {
      return;
    }
    this.clearRetry();
    const delay = Math.max(0, retryAt.getTime() - Date.now());
    this.retryTimer = globalThis.setTimeout(() => {
      this.retryTimer = undefined;
      if (
        typeof document !== "undefined" &&
        document.visibilityState !== "visible"
      ) {
        return;
      }
      void this.syncNow().catch(() => undefined);
    }, delay);
  }

  private clearRetry(): void {
    if (this.retryTimer !== undefined) {
      globalThis.clearTimeout(this.retryTimer);
      this.retryTimer = undefined;
    }
  }

  private isCurrentGeneration(generation: number): boolean {
    return this.isActive && generation === this.generation;
  }

  private setStatus(status: OfflineLibraryStatus): void {
    this.status = status;
    for (const listener of this.listeners) {
      listener(status);
    }
  }
}
