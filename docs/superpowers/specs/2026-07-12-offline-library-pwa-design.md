# Offline Library PWA Design

**Date:** 2026-07-12  
**Status:** Implemented, with follow-up remediation in progress

**Follow-up findings:** [Offline Library PWA Audit](2026-07-31-offline-library-pwa-audit.md)

## Goal

Make Karakeep's Safari-installed iPhone PWA fast to reopen and useful without a network connection. The app must cache its shell and maintain an offline library that supports browsing, local search, thumbnails, and a narrow set of queued writes. The design prioritizes the installed iPhone PWA while retaining standards-based benefits in other supported browsers.

## Scope

### Included

- Cache the versioned application shell and static assets for fast PWA relaunch.
- Maintain an authenticated, user-scoped offline library containing all currently authorized bookmark metadata, lists, tags, permission scope, thumbnails, and a local search index.
- Include content from shared lists while the signed-in user remains authorized.
- Support local-only search across title, URL, note or text-bookmark content, tags, summaries, lists, and replicated metadata.
- Fetch thumbnails over any available network, including cellular.
- Evict least-recently-used thumbnails when storage is constrained while retaining metadata and local search.
- Queue offline bookmark metadata and tag changes with optimistic local state.
- Detect field-level concurrent edits, merge edits to different fields, and require explicit resolution for same-field conflicts.
- Replace the current header processing control with a unified library activity indicator for connection, synchronization, offline writes, errors, conflicts, and existing server processing.
- Purge all private offline data and pending writes immediately on logout.

### Deferred or excluded

- PDF and archived reader-page replication.
- Offline full-text search of PDFs and archived reader pages.
- Offline file uploads and file-backed bookmark creation.
- Offline crawling, archive preservation, OCR, AI summaries, embeddings, and other server jobs.
- Offline collaboration or sharing changes.
- Offline bulk destructive actions, list deletion, and other compound operations.
- A database migration from SQLite or adoption of PowerSync.

## Chosen architecture

Use a purpose-built offline replica over Karakeep's existing authenticated API and SQLite source of truth.

PowerSync is not selected: its service supports PostgreSQL, MongoDB, MySQL, SQL Server, and experimental Convex source databases, but not Karakeep's SQLite source. Adopting it would require a database migration or a second data pipeline and materially expand the fork's operational surface.

### Client stores

| Store | Responsibility | Lifecycle |
|---|---|---|
| App-shell cache | Versioned Next.js JS/CSS, fonts, icons, manifest, and static UI assets | Precache on install; atomically replace for a deployed version; activate the updated shell on next PWA open |
| Offline library | Bookmark metadata, lists, tags, access scope, local-search records, sync cursor, mutation outbox, and conflict records | Create after sign-in; synchronize incrementally; purge on logout |
| Thumbnail cache | Thumbnail responses plus last-access information | Fill in background on any connection; evict least recently used thumbnails under storage pressure |

The app shell never treats authenticated HTML or API responses as universal static shell content. User data remains in the authenticated offline-library store.

### Server sync boundary

Karakeep retains SQLite as its sole source of truth. A dedicated sync boundary, separate from ordinary page queries, supplies:

1. **Snapshot:** the signed-in user's currently authorized library for initial synchronization.
2. **Delta feed:** inserts, updates, deletions, and authorization revocations after an opaque cursor.
3. **Mutation batch:** supported offline-safe writes with idempotency keys and changed-field base versions.
4. **Conflict response:** same-field concurrent updates that require user resolution.

The service validates session and authorization for every request. Browser state is always a replica, never authoritative.

## Synchronization behavior

### Lifecycle

- On sign-in or foreground, render from the local replica if present, then request deltas from its cursor.
- On first sign-in, keep the normal online dashboard usable while the offline library synchronizes in the background.
- On reconnect, verify connectivity with a successful sync request rather than relying only on `navigator.onLine`; then upload queued writes in order, receive deltas, and resume thumbnail downloads.
- When offline, use the local replica for browsing and search. Eligible metadata/tag changes update local state immediately and enter the durable mutation outbox.
- On next successful synchronization, delete records and thumbnails that are no longer authorized, including revoked shared-list access.
- On logout, purge all user-scoped data: metadata, thumbnails, local index, conflicts, sync cursor, and queued writes. The non-sensitive app shell remains cached.
- App-shell update discovery, version visibility, and safe activation follow [PWA Version Visibility and Safe Auto-Update Design](2026-08-16-pwa-version-updates-design.md). A running app is never replaced merely because a newer worker downloads; a waiting build takes over on a later safe load or after old clients close.

### Offline-safe write policy

Supported offline-safe writes are edits to existing bookmark metadata and tags, add or remove membership in an existing list, delete one owned bookmark after its undo window, create a tag inline while editing an existing bookmark, and create a text-only bookmark. Every queued write has an idempotency key and is visibly marked pending until server acknowledgement. Link creation, uploads, standalone tag or list management, list creation, collaborator changes, and bulk actions remain online-only.

Different-field edits merge automatically. If two replicas edit the same field after their shared base version, Karakeep creates a field conflict. The user selects a value through the activity indicator's conflict flow.

### Local search boundary

Offline search queries only fields in the replicated library: title, URL, notes/text bookmarks, tags, summaries, lists, and metadata. It does not claim parity with online search for PDF or archived page text that is not replicated.

## Unified library activity indicator

Upgrade `ProcessingStatusIndicator`, the compact header control immediately left of the profile menu, into the library activity indicator. It retains the existing server-processing behavior and additionally presents PWA connectivity and synchronization.

| State | Compact state | Popover |
|---|---|---|
| Online and idle | Subtle online-state glyph | Connection state and last successful sync time |
| Server processing | Existing spinner and count | Existing processing breakdown |
| Synchronizing | Sync glyph with progress/count | Metadata, index, thumbnail, and queued-write progress |
| Offline | Offline glyph | Offline-library state and last successful sync time |
| Offline writes pending | Offline glyph plus pending count | Pending mutation count and supported-write scope |
| Sync failure | Persistent attention state | Failure reason and retry action |
| Field conflict | Persistent attention state | Bookmark/field values and explicit resolution controls |

When local synchronization and server processing overlap, one compact control opens a popover containing two distinct groups. Their counts are not combined.

## Integrity and degradation

1. The server remains authoritative.
2. Mutation replay is at most once through idempotency keys.
3. Different fields merge; same-field conflicts require user choice.
4. Authorization revocations remove cached records during the next successful synchronization.
5. Logout is a hard privacy boundary that removes every private offline artifact.
6. Under storage pressure, preserve metadata and local search, evict thumbnails by least recent use, and refill thumbnails only when online.
7. Treat `navigator.onLine` as a hint, not proof of connectivity.
8. If no local replica exists and the device is offline, present an explicit unavailable state rather than an empty library.
9. If a local schema is corrupt or incompatible, discard and recreate only the local replica after reconnection; preserve the app shell.
10. Preserve queued writes after transient sync failure. Retry with bounded backoff on foreground or reconnect and expose retry through the activity indicator.
11. Thumbnail failure must not block metadata sync or local search.

## Verification requirements

### Automated contracts

- Service-worker routing and versioned cache lifecycle.
- Offline-library schema migrations, local search, thumbnail LRU eviction, and logout purge.
- Snapshot/delta correctness for creation, update, deletion, cursor continuation, and shared-access revocation.
- Idempotent mutation replay, retry ordering, field merges, and same-field conflict records.
- Activity-indicator states: online, offline, synchronizing, pending write, error, conflict, and existing server processing.
- Existing processing-indicator behavior when no local synchronization is active.

### Browser and device acceptance checks

- A warm Safari-installed iPhone PWA relaunch does not redundantly download versioned static assets.
- After initial synchronization, offline browsing and local-only search work without a network connection.
- Supported offline writes synchronize exactly once after reconnection.
- A same-field concurrent edit asks for resolution; different-field edits merge.
- Logout leaves no user metadata, thumbnail, local-search result, or queued mutation accessible.
- Storage pressure retains metadata/search and gracefully replaces evicted thumbnails with a deliberate placeholder until online.
