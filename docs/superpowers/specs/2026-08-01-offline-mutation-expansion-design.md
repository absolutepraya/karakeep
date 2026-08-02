# Offline Mutation Expansion Design

**Date:** 2026-08-01
**Status:** P3 list membership, P4 single-bookmark deletion, P5 inline tag creation, and P6 text-note creation implemented
**Related audit:** [Offline Library PWA Audit](2026-07-31-offline-library-pwa-audit.md)

## Problem

The installed PWA currently supports offline edits to existing bookmark fields
and tag membership. It can also create a tag while attaching it to an existing
bookmark and save a text note. The rest of the UI correctly requires a
connection:

- link bookmark creation and uploads;
- bulk destructive actions;
- adding or removing a bookmark from a list;
- standalone tag management; and
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
| Create text bookmark | Client UUID | Quota rejection and create-then-delete cancellation | Ship first with the server persisting the UUID |
| Create link bookmark | Client UUID | URL deduplication may return a different existing bookmark | Requires client-to-server ID mapping and dependent mutation rewriting |
| Create tag inline with an existing bookmark | Client UUID | Remote tag name collision and stale tag field | Ship as a `bookmark.tags` extension; no ID remapping when the server persists the UUID |
| Standalone tag creation | Client UUID | Replicated tag catalog and later reference resolution | Separate tag-catalog slice |
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

## Implemented P4: single-bookmark deletion

The existing five-second undo window remains before any offline mutation is
created. After it expires, deletion atomically writes a `bookmark.delete`
outbox item and a tombstone. Local grid and search queries hide tombstoned
bookmarks while the replica row remains available for recovery. The delete
supersedes queued field, tag, and list-membership intent for that bookmark.

An acknowledgement alone does not clear a tombstone because the following
pull can still fail. It is removed only when an authoritative delete event or
snapshot settles the replica. If replay is rejected, the tombstone remains
until the user chooses the existing discard-and-refresh action. Bulk deletion
is still online-only.

## Implemented P5: inline tag creation

When a user creates a tag from an existing bookmark's tag editor while offline,
the client creates a UUID and includes `{ id, name }` in the existing
`bookmark.tags` mutation. The optimistic bookmark replica renders and searches
that name immediately. The server validates the name, persists that exact UUID
for the current user, then attaches it as part of the same transaction.

The server rejects an ID collision, duplicate tag name, invalid name, or a tag
set that refers to a created tag incorrectly. A stale tag-field conflict keeps
the created-tag metadata so the existing "keep mine" resolution can replay the
same creation intent. Repeated local tag edits coalesce their created tags and
discard an unpushed created tag if the final tag set no longer includes it.

This is deliberately not a general offline tag catalog. The Tags page remains
online-only for creation, rename, deletion, and merge. A tag that already
exists remotely but is absent from the local bookmark context can be rejected
as a duplicate rather than guessed or silently remapped.

## Implemented P6: text-note creation

The New Item editor can create a text note while offline. The client generates
a UUID, writes a complete local text bookmark and zero-value field versions in
the same IndexedDB transaction as the outbox mutation, then shows the note
immediately. The server rechecks quota, persists that UUID, records a create
event, and runs the same indexing, rule, search, and webhook effects as online
text creation.

If a local-only text note is deleted before replay, its create mutation and
optimistic record are removed together. It does not send a delete for a
bookmark the server never received. Link creation remains network-only because
the existing URL-deduplication behavior can return a different canonical ID.

## Explicitly out of this increment

No offline link bookmark or list creation, uploads, standalone tag management,
collaborator changes, or bulk destructive controls are enabled by this design.
Each needs canonical ID remapping, a new durable local entity, or a dedicated
transfer protocol.
