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
13. Explicit descendant grants are supported. Effective access is resolved from the exact-list direct grant first, then the nearest ancestor recursive grant.

## Recursive access model

Do not materialize inherited memberships onto every descendant. Store `recursive` on direct collaborator memberships and invitations, then resolve effective access dynamically from the list ancestry.

This preserves a single source of truth for each explicit grant, automatically covers future descendants, and avoids destructive fan-out when lists move.

For a requested list:

1. Owner access wins.
2. If the user has a direct collaborator grant for that exact list, use it.
3. Otherwise walk ancestors from nearest to farthest and use the first collaborator grant for that user with `recursive = true`.
4. Otherwise access is denied.

A non-recursive direct grant affects only its exact list. A recursive direct grant affects that list plus descendants until a closer direct/recursive grant changes the effective result.

## Invitations

An invitation creates a future direct grant and stores both `role` and `recursive`. Accepted invitations become direct collaborator memberships with the same values. Declined invitations remain only as lifecycle history needed for reinvitation handling and are excluded from the normal owner list. Expired invitations are computed from `invitedAt`; no scheduled expiry job is required.

Invitation deep links use the invitation ID rather than a list ID. The invitee inbox can therefore open the exact invitation without leaking inaccessible list hierarchy.

## Email

Email is attempted only after the database transaction succeeds. The backend returns enough delivery state for clients to distinguish `invitation created` from `email sent`. SMTP being absent or a send failure must not roll back the invitation. Resend is explicit and renews expiry.

All user-controlled values inserted into HTML email must be escaped. Plain-text email remains available.

## UI

### Web

- Remove the Beta badge.
- Manage Collaborators shows accepted and pending entries, roles, recursive scope, expiry, resend, revoke, and confirmed removal.
- `Also share all nested lists` defaults off and explains that current and future nested lists are included when enabled.
- Removing a collaborator explains that bookmark entries contributed through that direct membership disappear from the list while underlying bookmarks remain.
- Viewer-only users never see edit/remove list-membership actions.

### Mobile

- Lists surface pending invitations and accept/decline actions.
- Owners get Manage Collaborators from the list actions menu.
- The management screen supports invite, role/scope changes, resend/revoke, and confirmed collaborator removal.
- Collaborators retain Leave List.

## Intentional non-goals

- Ownership transfer.
- Comments, presence, activity feed, or real-time collaborative editing.
- Inviting unregistered email addresses.
- Durable email outbox/background retry infrastructure.
