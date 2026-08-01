# Offline Mutation Expansion Design

**Date:** 2026-08-01
**Status:** P3 existing-list membership implemented, later slices proposed
**Related audit:** [Offline Library PWA Audit](2026-07-31-offline-library-pwa-audit.md)

## Problem

The installed PWA currently supports offline edits to existing bookmark fields
and tag membership only. The rest of the UI correctly requires a connection:

- bookmark creation and uploads;
- bookmark deletion and bulk destructive actions;
- adding or removing a bookmark from a list;
- creating a tag; and
- creating, deleting, or collaborating on lists.

The current offline-sync schema only accepts `bookmark.update` and
`bookmark.tags`. Disabling the online-only UI guards without a matching durable
protocol would lose user intent or leave an outbox item that can never settle.

## Existing guarantees to preserve

1. The server is authoritative and authenticates every replayed mutation.
2. The local outbox is user-scoped and coalesces repeated field or tag intent.
3. Mutations have durable idempotency receipts on the server.
4. A local optimistic write and its outbox item commit atomically.
5. Logout and a principal transition purge the entire replica and outbox.
6. Shared-list access may change while the client is offline.

## Required protocol capabilities

Every newly supported offline mutation needs all of the following before its
UI becomes available offline:

1. A versioned shared-schema variant with an idempotency key.
2. A single IndexedDB transaction that changes the replica and writes the
   outbox record.
3. A replay handler that rechecks ownership and current list permissions.
4. An explicit settled result: acknowledged, field conflict, or actionable
   rejection. A generic transport retry is not a rejection result.
5. A local resolution path for rejection, either discard/restore, retry after
   user changes the input, or resync from the server.
6. Regression coverage for replay, duplicate replay, reconnect after a remote
   change, logout before replay, and a device acceptance check.

## Candidate slices

| Slice | Local identity needed | Main replay risk | Recommendation |
| --- | --- | --- | --- |
| Remove bookmark from an existing list | No | Access can be revoked while offline | First candidate after actionable-rejection support |
| Add bookmark to an existing list | No | Access can be revoked, list may be deleted | Same protocol as removal, ship together |
| Delete existing owned bookmark | No | Undo window, remote edit, and destructive replay | Second slice, use a local tombstone and cancellable outbox entry |
| Create bookmark | Yes, client bookmark ID | Server deduplication may return a different existing bookmark | Requires client-to-server ID mapping and dependent mutation rewriting |
| Create tag | Yes, client tag ID | Newly created ID is referenced by later tag mutations | Requires ID mapping and a replicated tag catalog |
| Upload or attach assets | Yes, local asset record | Blob durability, upload retries, quota, and multipart protocol | Separate asset-transfer project |
| Bulk actions | No new identity | Partial success and undo semantics | Compose only after each primitive is proven |
| Create or alter lists | Yes for new lists | Collaborator permissions and hierarchy cycles | Separate shared-list synchronization project |

## Implemented P3: existing-list membership

The implemented mutation variant has explicit set semantics:

```ts
{
  idempotencyKey: string;
  kind: "bookmark.listMembership";
  bookmarkId: string;
  listId: string;
  action: "add" | "remove";
}
```

The client inserts or deletes the matching local membership in the same
transaction as the outbox write. Repeating the same action is idempotent. On
replay, the server checks that the bookmark and list still exist and that the
current user has the required permission. A rejected action must become a
visible outbox resolution item, not an indefinitely retried sync error.

The client changes the local membership and outbox record atomically, then
replays through the server's current list-access checks. Add requires bookmark
ownership, while removal retains the server's existing editor permission model.
Repeated intent for the same bookmark and list coalesces, but separate lists
remain independent. A permanent rejection is surfaced through the existing
discard-and-refresh flow.

This slice excludes new lists, shared-list collaborator changes, and bulk
operations. It has no temporary IDs, binary data, or irreversible bookmark
deletion.

## Later delete design

Deleting a bookmark offline must create a local tombstone instead of only
removing the row. The tombstone hides the bookmark from queries but preserves
the original record and a cancellable outbox item through the existing
five-second undo window. If replay is rejected, the app restores the record
from the tombstone and explains why. A delete supersedes queued field, tag,
and list-membership intents for the same bookmark.

## Explicitly out of this increment

No offline creation, new tags, uploads, list creation, collaborator changes,
or bulk destructive controls are enabled by this design. Each needs temporary
ID remapping, a new durable local entity, or a dedicated transfer protocol.
