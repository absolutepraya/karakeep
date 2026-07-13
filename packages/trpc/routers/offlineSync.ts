import {
  zOfflineSyncPullInputSchema,
  zOfflineSyncPullResultSchema,
  zOfflineSyncPushInputSchema,
  zOfflineSyncPushResultSchema,
  zOfflineSyncSnapshotSchema,
} from "@karakeep/shared/types/offlineSync";

import { createScopedAuthedProcedure, router } from "../index";
import {
  applyOfflineSyncMutations,
  buildOfflineSyncSnapshot,
  pullOfflineSyncEvents,
} from "../models/offlineSync";

const offlineSyncProcedure = createScopedAuthedProcedure("bookmarks");

export const offlineSyncAppRouter = router({
  snapshot: offlineSyncProcedure
    .output(zOfflineSyncSnapshotSchema)
    .query(async ({ ctx }) => await buildOfflineSyncSnapshot(ctx)),
  pull: offlineSyncProcedure
    .input(zOfflineSyncPullInputSchema)
    .output(zOfflineSyncPullResultSchema)
    .query(
      async ({ ctx, input }) => await pullOfflineSyncEvents(ctx, input.cursor),
    ),
  push: offlineSyncProcedure
    .input(zOfflineSyncPushInputSchema)
    .output(zOfflineSyncPushResultSchema)
    .mutation(
      async ({ ctx, input }) =>
        await applyOfflineSyncMutations(ctx, input.mutations),
    ),
});
