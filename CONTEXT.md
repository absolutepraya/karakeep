# Domain Context

## Product identity

- **Marka**: The public product identity for this repository and its operator-facing surfaces.
- **Operator-facing name**: A human-visible repository, guide, installer, skill, path, or service label that can change without changing persisted data, protocols, package scopes, or environment-variable contracts.
- **Compatibility identifier**: A retained Karakeep-era name used by code, packages, environment variables, persisted data, export formats, mobile schemes, or external distribution contracts.

## List collaboration

- **List owner**: the user who owns a list. Ownership is not a collaborator membership and is never inherited.
- **Collaborator**: a non-owner user with accepted access to a manual list as `viewer` or `editor`.
- **Direct grant**: a collaborator membership attached to one specific list.
- **Recursive grant**: a direct grant whose role may be inherited by descendants of that list, including descendants created or moved into the subtree later.
- **Inherited access**: effective access to a list obtained from the nearest ancestor direct grant for the same user whose recursive flag is enabled.
- **Effective role**: the role used for authorization on a list. A direct grant on the list wins. Otherwise the nearest recursive ancestor grant wins. Otherwise the user has no collaborator access.
- **Accessible shared hierarchy**: the portion of an owner's real list tree that a collaborator can access. Parent/child relationships are preserved between accessible nodes; an inaccessible ancestor is omitted and the first accessible descendant becomes a shared root.
- **Invitation**: a pending offer for a direct grant. Invitations may request viewer/editor access and may optionally request recursive sharing.
- **Declined invitation**: retained lifecycle history that does not grant access and is hidden from the normal collaborator-management response; the same user can be invited again later.
- **Invitation expiry**: a pending invitation is valid for 30 days from `invitedAt`. Resending renews `invitedAt` for another 30 days.
- **Public access**: anonymous read-only access to a list through its public-list mechanism. Public access never creates collaborator membership and is independent from collaboration.
- **Contributed bookmark membership**: a bookmark-to-list association created through a collaborator membership. Removing that direct membership removes associations tied to it, but never deletes the underlying bookmark.

## Permission rules

- Collaboration applies only to manual lists.
- Viewers are read-only. Editors can add/remove bookmark memberships. Only owners manage list metadata and collaborators.
- Recursive sharing is opt-in per direct grant and defaults off.
- Current and future descendants can inherit a recursive grant.
- Moving a descendant out of a recursively shared subtree removes access that existed only through that inheritance.
- Explicit direct access on a descendant overrides an inherited role on that descendant. Descendants inherit from the nearest recursive direct grant available on their own ancestor chain.
- Accessible parents remain navigable in the shared hierarchy. Inaccessible ancestors are not revealed.
- Public sharing and collaborator sharing can coexist on the same list.
