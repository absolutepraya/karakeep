---
sidebar_position: 2
---

# Lists

Lists are the core organizational layer in Karakeep. Every saved item can sit in multiple lists so you can group links by project, topic, or audience without duplicating them.

## Manual lists

- Curated sets you add bookmarks to by hand. Great for projects, reading queues, or hand-picked collections.
- Can be **private** (visible only to you) or **public** (share a read-only link).
- Can be **collaborative** with other existing users.

### Collaborating on a list

The list owner can invite an existing user by email and choose a role:

- **Viewer**: can browse the list and its bookmarks, but cannot add or remove list entries.
- **Editor**: can browse the list and add or remove bookmark entries.
- **Owner**: controls the list itself, including its name, settings, public sharing, and collaborators.

Invitations remain pending for 30 days. The owner can change a pending invitation between Viewer and Editor, change its nested-list scope, revoke it, or resend it. Resending renews the invitation for another 30 days. If email delivery is unavailable, the invitation still exists in Karakeep and can be resent later.

Declined invitations disappear from the normal collaborator-management view. The owner can invite that user again later.

Collaboration is available in both the web app and the native mobile app, including accepting or declining invitations and owner-side collaborator management.

### Sharing nested lists

By default, inviting someone shares **only the selected list**.

Enable **Also share all nested lists** to make the grant recursive. A recursive grant includes:

- lists already nested below the shared list;
- lists created below it later; and
- existing lists moved into that subtree later.

If a list is moved out of the recursively shared subtree, access inherited only from that ancestor disappears automatically.

A direct grant on a nested list overrides inherited access on that list. For example, a user can inherit Viewer access from a recursively shared parent while receiving Editor access directly on one child list. Otherwise, the nearest recursively shared ancestor determines the inherited role.

Shared lists keep their normal hierarchy wherever the collaborator can access that hierarchy. If both a parent and child are accessible, they appear nested normally in **Shared Lists**. If an ancestor is not accessible, it is not revealed; the first accessible descendant appears as a shared root instead. If parent access is later removed while an independent child grant remains, that child automatically becomes a root in the collaborator's shared tree.

On the web, accessible ancestors are available as clickable breadcrumbs while viewing a nested shared list. On native mobile, the list header lets you move up to the accessible parent. Hidden ancestors never appear in either path.

### Leaving and removing collaborators

When a collaborator leaves, or the owner removes their direct grant, bookmark entries contributed through that collaboration are removed from the shared list. The collaborator's underlying bookmarks stay in their own library.

For recursively shared access, removing the source grant also removes access that descendants inherited from it. Independent direct grants on descendant lists remain independent.

### Public sharing and collaboration

Public sharing is separate from collaboration. A collaborative list can also have a public link, but visitors using that link are always read-only and do not become collaborators.

### Current collaboration limits

Collaboration is supported for manual lists. It does not currently include ownership transfer, comments, presence/activity feeds, real-time co-editing, or invitations to email addresses that do not already belong to a Karakeep user.

Your personal states, such as favourite and archive, remain yours even inside a shared list.

## Smart lists

- Auto-updating lists powered by a saved search query (e.g. `#ai -archived`).
- Best for dynamic views like `Youtube links added last week` or `All reddit links from r/selfhosted`.