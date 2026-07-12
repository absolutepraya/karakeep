# Karakeep

Karakeep is a personal bookmark library. This context records its product terms where they need a single meaning.

## Progressive web app performance

**iPhone PWA performance contract**:
The loading and caching experience of Karakeep when installed from Safari on iPhone. It prioritizes this installed mode while retaining standards-based benefits for other supported browsers.
_Avoid_: mobile-only performance, Safari-only cache

**Offline library**:
A locally stored, user-scoped replica of all bookmark metadata, thumbnails, and a local search index that remains available in the installed PWA without a network connection. PDFs and archived reader content remain on-demand online content for the first release.
_Avoid_: static asset cache, browser cache

**Offline-safe write**:
A bookmark metadata or tag change made without connectivity that is durably queued, visibly pending synchronization, and later applied at most once to the authoritative library.
_Avoid_: offline mutation, background action

**Field conflict**:
Two edits to the same bookmark field made from different library replicas after their shared base version. Karakeep merges edits to different fields automatically and requires the user to select a value for a field conflict.
_Avoid_: sync error, overwrite

**Authorized offline library**:
The offline library contains every bookmark the signed-in user is currently authorized to access, including shared-list content. A successful synchronization removes content that is no longer authorized.
_Avoid_: owned-only cache, permanent shared copy

**Offline-library purge**:
The immediate removal of a signed-in user's offline library, thumbnail cache, search index, and offline-safe writes when that user logs out. The installable static app shell remains.
_Avoid_: sign-out cache retention, delayed deletion

**Thumbnail retention**:
The best-effort thumbnail cache for an offline library. Under storage pressure, Karakeep retains the metadata and search index while evicting least-recently-used thumbnails and restoring them when connected.
_Avoid_: mandatory thumbnail mirror, storage-full sync failure

**Library activity indicator**:
The header control immediately left of the profile menu that presents the PWA's online or offline state alongside server background-processing work and local offline-library synchronization. It exposes connection state, progress, pending offline-safe writes, failures, and an action to retry or resolve a field conflict.
_Avoid_: processing-only indicator, hidden sync state

**Unrestricted thumbnail sync**:
Automatic thumbnail synchronization over any available network connection, including cellular. It does not require a Wi-Fi-only or confirmation setting.
_Avoid_: Wi-Fi-only thumbnail sync, manual cellular approval

**Local-only search**:
Offline search over fields stored in the offline library: bookmark title, URL, note or text content, tags, summaries, lists, and metadata. It does not claim to search archived pages or PDFs that were not replicated.
_Avoid_: offline full-text parity, disabled offline search

## Lightweight deployment

**Screenshot-first capture**:
A bookmark-capture policy that treats a rendered page screenshot as the essential automated artifact. Reader-mode extraction, PDF capture, and full-page archival are optional and may be disabled to reduce deployment cost.
_Avoid_: full archival, browserless-only capture

**Shared screenshot renderer**:
A single Browserless Chrome service on the VPS that provides rendered screenshot sessions to Karakeep and RSSHub over an isolated Docker network. It is capacity-governed rather than embedded in either application deployment.
_Avoid_: application-owned Chrome container, public renderer endpoint

**Capacity-managed capture**:
Screenshot jobs wait for the shared renderer and retry after a bounded capacity or timeout failure. A bookmark is saved independently of screenshot completion.
_Avoid_: fail-fast screenshot capture, reserved renderer capacity
