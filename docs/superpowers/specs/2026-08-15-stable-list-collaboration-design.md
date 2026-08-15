# Stable List Collaboration Design

## Goal

Graduate manual-list collaboration from Beta to a stable web-and-mobile feature with explicit invitation lifecycle, truthful email delivery, full owner management, and optional recursive access for nested lists.

## Product contract

1. Invitations target existing Marka users only. Email matching is normalized and failures must not reveal whether an account exists.
2. Pending invitations expire 30 days after `invitedAt`.
3. Declined invitations disappear from the normal owner management surface and the same user may be invited again later.
4. Owners can change viewer/editor role while an invitation is pending.
5. Native mobile has full collaboration parity: invitation discovery, accept/decline, shared-list use/leave, and owner collaborator management.
6. Invitation state commits before email is attempted. UI distinguishes invitation creation from email delivery. Owners can resend manually. A durable outbox is intentionally out of scope.
7. Resend renews `invitedAt`, giving the invitation a fresh 30-day lifetime.
8. The Beta badge is removed in the same change only after the stable contract, tests, and docs are present.
9. Public access and collaboration are independent. Public visitors are read-only even if the list also has collaborators.
10. Sharing is direct by default. `Also share all nested lists` is an opt-in control and defaults off.
11. When recursive sharing is enabled, current and future descendants inherit access.
12. Moving a descendant outside the recursively shared subtree removes inherited access.
13. Explicit descendant grants are supported. Effective access is resolved from the exact-list direct grant first, then the nearest qualifying ancestor recursive grant.
14. Shared-list hierarchy is access-filtered rather than globally flattened: if a collaborator can access both a list and its parent, the real parent/child relationship is preserved; otherwise the first accessible descendant becomes a shared root.

## Recursive access model

Do not materialize inherited memberships onto every descendant. Accepted direct collaborator memberships remain in `listCollaborators`. Recursive scope is persisted separately in `listCollaborationScopes`, keyed by `(listId, userId)`, and effective access is resolved dynamically from list ancestry.

Invitation rows are future direct grants, not active access. A pending invitation can have a corresponding scope row so the requested recursive setting survives role/scope edits, but pending, expired, and declined invitations do not participate in authorization. Declining or revoking an invitation removes its scope row; reinviting recreates it atomically. Accepting the invitation atomically replaces the invitation with an accepted membership while explicitly preserving the requested scope.

This preserves a single explicit membership per accepted grant, automatically covers future descendants, and avoids destructive fan-out when lists move.

For a requested list:

1. Owner access wins.
2. If the user has an accepted direct collaborator membership for that exact list, use it.
3. Otherwise walk ancestors from nearest to farthest and use the first accepted collaborator membership for that user whose scope has `recursive = true`.
4. Otherwise access is denied.

A non-recursive direct grant applies only to its exact list. It does **not** block a farther recursive ancestor from granting access to deeper descendants. For example, if `Root` is recursively shared, `Child` has a non-recursive direct override, and `Grandchild` has no direct grant, `Grandchild` can still inherit from `Root`. A direct grant on the requested list always wins for that exact list.

## Accessible hierarchy

Collaboration should feel like navigating a shared folder tree rather than a collection of isolated list shortcuts.

The list collection exposed to a collaborator is the owner's real tree filtered by effective access:

- If both a list and its parent are accessible, keep the real `parentId` so normal tree navigation, indentation, and upward navigation work.
- If the parent is not accessible, expose the child as a root by returning `parentId = null`; do not reveal the inaccessible ancestor's ID, name, or existence.
- If recursive parent access is later removed while an explicit child grant remains, that child automatically becomes a shared root.
- Internal authorization always uses the real unsanitized hierarchy. Privacy-filtered list DTOs must not be fed back into access-resolution logic.

The web sidebar must reuse the original dashboard sidebar styling and interaction patterns. `Shared Lists` remains the existing collapsible section and shared nodes use the same `SidebarItem`, nesting, spacing, icons, hover/active states, collapse affordances, and list options as normal lists. No parallel sidebar design system is introduced.

Web list pages show the accessible path as lightweight clickable breadcrumbs above the existing list title. Native mobile follows the same access-filtered tree model using its existing Lists hierarchy UI and replaces the child screen's back affordance with an explicit up-navigation action when an accessible parent exists.

## Invitations

An invitation creates a future direct grant and stores the requested role in the invitation row plus recursive scope in `listCollaborationScopes`. Invitation, membership, and scope changes that belong to one lifecycle transition are atomic.

Accepted invitations become direct collaborator memberships. Declined invitations remain only as lifecycle history needed for reinvitation handling and are excluded from the normal owner list. Expired invitations are computed from `invitedAt`; no scheduled expiry job is required. Expired invitations cannot be accepted, but the invitee may decline them to clear the pending invitation, and the owner may resend them to renew the 30-day window.

Invitation deep links use the invitation ID rather than a list ID. The invitation ID is never an authorization credential: invitation reads and mutations require an authenticated user and verify that the caller is the intended invitee or list owner as appropriate. IDs belonging to other users resolve like missing invitations rather than revealing their existence.

## Email

Email is attempted only after the database transaction succeeds. The mutation returns the delivery result for that attempt so clients can distinguish `invitation created` from `email sent`. SMTP being absent, timing out, or failing must not roll back the invitation. Delivery state is intentionally not a durable queue/outbox record in this scope; resend is the explicit recovery path and renews expiry.

All user-controlled values inserted into HTML email must be escaped. Plain-text email remains available, and SMTP connection/greeting/socket timeouts bound delivery attempts.

## UI

### Web

- Remove the Beta badge.
- Manage Collaborators shows accepted and pending entries, roles, recursive scope, expiry, resend, revoke, and confirmed removal.
- `Also share all nested lists` defaults off and explains that current and future nested lists are included when enabled.
- Removing a collaborator explains that bookmark entries contributed through that direct membership disappear from the list while underlying bookmarks remain.
- Viewer-only users never see edit/remove list-membership actions.
- Shared trees render inside the existing `Shared Lists` sidebar section with the exact normal dashboard list styling; accessible ancestors remain navigable and inaccessible ancestors are omitted.
- List headers expose the accessible path as clickable, semantic breadcrumbs without revealing inaccessible ancestors.

### Mobile

- Lists surface pending invitations and accept/decline actions.
- Owners get Manage Collaborators from the list actions menu.
- The management screen supports invite, role/scope changes, resend/revoke, and confirmed removal.
- Collaborators retain Leave List. Leaving removes the nearest effective direct grant; if a farther recursive grant still applies, some access may remain.
- Shared lists preserve the same access-filtered parent/child hierarchy used by web.
- When a list has an accessible parent, the native header provides an accessible up action to that parent instead of dropping the user back to the shared-list root.

### Browser extension

The browser extension continues to rely on the same server-side list authorization for bookmark/list mutations, so viewer/editor/revocation changes are enforced by the backend. Dedicated invitation and collaborator-management UI in the extension is deferred; stable management parity in this scope is web plus native mobile.

## Intentional non-goals

- Ownership transfer.
- Comments, presence, activity feed, or real-time collaborative editing.
- Inviting unregistered email addresses.
- Durable email outbox/background retry infrastructure.
- Dedicated browser-extension collaboration management UI.
