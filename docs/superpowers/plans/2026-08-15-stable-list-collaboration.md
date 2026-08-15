# Stable List Collaboration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Graduate manual-list collaboration from Beta to stable across web and mobile, including 30-day invitations, truthful/resendable email, opt-in recursive nested-list access, and Drive-style navigation across accessible shared hierarchy.

**Architecture:** Keep accepted direct memberships in `listCollaborators`. Persist recursive scope separately in `listCollaborationScopes`, keyed by `(listId, userId)`. Pending invitations are future grants and may have scope rows, but only accepted memberships participate in authorization. Resolve effective access at read/authorization time from an exact-list accepted membership first and then the nearest qualifying recursive ancestor. This makes current/future descendants inherit automatically without materialized child memberships. Invitation/membership/scope lifecycle writes are atomic; email delivery happens after the committed invitation transition and never rolls back it.

**Tech Stack:** TypeScript, tRPC, Drizzle ORM, SQLite, Next.js/React, React Native/Expo, TanStack Query, Vitest.

## Global Constraints

- Collaboration remains manual-list only.
- Existing registered users only; normalize email and avoid account-enumerating error copy.
- Invitation expiry is exactly 30 days from `invitedAt`; resend resets `invitedAt`.
- `Also share all nested lists` defaults off.
- Public-list access remains independent and read-only.
- Viewer is read-only; editor edits bookmark memberships; owner alone manages metadata/collaborators.
- Recursive access includes current/future descendants and disappears when a list leaves the ancestor subtree.
- Exact-list direct grants win for that list. A non-recursive intermediate grant does not block a farther recursive ancestor from granting access to deeper descendants.
- Shared hierarchy exposes only accessible parents; inaccessible ancestors are omitted and descendants become shared roots.
- Web Shared Lists reuse the original dashboard sidebar components/styles; no second sidebar system.
- No durable email outbox, ownership transfer, comments/activity feed, or real-time editing.

---

### Task 1: Persist recursive grant scope and resolve effective access

**Files:**
- Create: `packages/db/collaborationScopes.ts`
- Modify: `packages/db/drizzle.ts`, `packages/db/index.ts`
- Create: `packages/db/drizzle/0088_list_collaboration_scopes.sql`
- Create/Modify: `packages/trpc/models/listCollaborationAccess.ts`, `packages/trpc/models/lists.ts`
- Test: `packages/trpc/routers/recursiveSharedLists.test.ts`, `packages/trpc/routers/sharedListHierarchy.test.ts`, `packages/trpc/routers/collaborationAccessSafety.test.ts`

**Interfaces:**
- `listCollaborationScopes(listId, userId, recursive)` is the scope source of truth.
- Accepted `listCollaborators` rows are the only collaborator memberships that authorize access.
- Effective access returns the direct membership row that sourced the grant, including when that membership belongs to an ancestor.

- [ ] **Step 1: Add failing backend tests** proving direct access, recursive descendants, future/moved-in descendants, move-out revocation, exact child overrides, farther recursive fallback past non-recursive intermediate grants, role enforcement, and private-hierarchy filtering.
- [ ] **Step 2: Run focused TRPC tests** and confirm the new cases fail before implementation.
- [ ] **Step 3: Add the collaboration-scope table + migration** with non-recursive behavior for existing memberships.
- [ ] **Step 4: Implement centralized effective-access resolution** from owner → exact accepted membership → nearest recursive accepted ancestor.
- [ ] **Step 5: Make shared-list enumeration preserve accessible parent relationships** while hiding inaccessible ancestors/siblings.
- [ ] **Step 6: Batch owner-tree/membership/scope loads for subtree access snapshots** so list moves do not perform per-descendant database reloads inside write transactions.
- [ ] **Step 7: Run focused tests again** and confirm recursive authorization/hierarchy cases pass.

### Task 2: Stabilize invitation lifecycle and email delivery

**Files:**
- Modify: `packages/trpc/models/listInvitations.ts`
- Modify: `packages/trpc/routers/lists.ts`
- Modify: `packages/trpc/email.ts`
- Test: `packages/trpc/routers/stableListInvitations.test.ts`

**Interfaces:**
- Invitation create/update accepts `{ email, role, recursive }`; role lives on the invitation row and recursive scope lives in `listCollaborationScopes`.
- Pending invitation validity: `Date.now() - invitedAt < 30 days` for acceptance.
- Expired pending invitations can still be declined or renewed by owner resend.
- Resend returns the delivery result for that attempt and renews `invitedAt`.
- Accept atomically replaces the invitation with a collaborator membership and explicitly preserves the requested scope.

- [ ] **Step 1: Add lifecycle tests** for normalized persisted email, neutral unknown-user failures, 30-day expiry, expired accept rejection, expired decline cleanup, declined reinvite, pending role/scope change, resend renewal/cooldown, and accepted recursive access.
- [ ] **Step 2: Add email tests** proving invitation creation survives absent/failing SMTP, delivery result is truthful, deep links contain invitation ID, HTML is escaped, and SMTP attempts are bounded by timeouts.
- [ ] **Step 3: Make invitation/scope lifecycle transitions atomic** for create, declined→pending reinvite, update, accept, decline, and revoke.
- [ ] **Step 4: Move email send after the committed invitation transition** and keep resend as explicit recovery rather than durable outbox retry.
- [ ] **Step 5: Filter owner management invitation rows to pending state** while retaining declined rows internally as history.
- [ ] **Step 6: Run focused lifecycle/email tests** and confirm pass.

### Task 3: Align web collaboration UI with stable semantics

**Files:**
- Modify/Test: `apps/web/components/dashboard/lists/ManageCollaboratorsModal.tsx`
- Modify/Test: `apps/web/components/dashboard/lists/PendingInvitationsCard.tsx`
- Modify/Test: `apps/web/components/dashboard/bookmarks/BookmarkOptions.tsx`
- Modify: `apps/web/components/dashboard/lists/ListHeader.tsx`
- Modify relevant i18n resources.

**Interfaces:**
- Owner management consumes accepted/pending state, role, recursive scope, expiry, and invitation ID.
- Mutations: invite, update accepted role/scope, update pending role/scope, resend, revoke, remove.

- [ ] **Step 1: Cover viewer removal-action hiding, recursive checkbox default-off copy, pending role/scope updates, expiry/resend, and removal confirmation.**
- [ ] **Step 2: Remove Beta and add stable collaborator management** with truthful delivery feedback.
- [ ] **Step 3: Keep viewer-only users from Remove-from-list actions** even when they own the underlying bookmark.
- [ ] **Step 4: Target invitation-ID deep links** and keep expired invitations dismissible while preventing expired acceptance.
- [ ] **Step 5: Preserve accessible shared hierarchy in the existing `Shared Lists` sidebar** using the original dashboard sidebar styling/components.
- [ ] **Step 6: Add semantic clickable breadcrumbs for accessible ancestors** without revealing hidden ancestors.
- [ ] **Step 7: Run focused web tests, React Doctor, lint, format, and typecheck.**

### Task 4: Add full native-mobile collaboration parity

**Files:**
- Modify: `apps/mobile/app/dashboard/(tabs)/(lists)/index.tsx`
- Modify: `apps/mobile/app/dashboard/lists/[slug]/index.tsx`
- Create/Modify: `apps/mobile/app/dashboard/lists/invitations.tsx`
- Create/Modify: `apps/mobile/app/dashboard/lists/[slug]/collaborators.tsx`

**Interfaces:**
- Mobile uses the same tRPC invitation/collaborator procedures as web.
- Owner list actions add Manage Collaborators; collaborator list actions keep Leave List.

- [ ] **Step 1: Add pending-invitation discovery** on the Lists tab and Accept/Decline screen.
- [ ] **Step 2: Add owner Manage Collaborators navigation** to list actions and gate stale/deep links by owner role.
- [ ] **Step 3: Build mobile management** with invite, role/scope changes, resend/revoke, and confirmed removal.
- [ ] **Step 4: Preserve the access-filtered shared tree** and add an accessible native up-navigation target to the visible parent.
- [ ] **Step 5: Invalidate list/invitation/collaborator queries** after mutations so native state updates immediately.
- [ ] **Step 6: Run mobile typecheck plus repository CI.**

### Task 5: Offline sync, docs, accessibility, and GA cleanup

**Files:**
- Test: `packages/trpc/routers/recursiveSharedListsOffline.test.ts`
- Modify: `docs/docs/04-using-karakeep/lists.md`
- Modify: `CONTEXT.md`
- Modify: this design/plan documentation.

**Interfaces:**
- Stable docs describe roles, recursive scope, invitation expiry/resend, web/mobile behavior, public-vs-collaborator access, accessible hierarchy, and intentional limitations.

- [ ] **Step 1: Add offline regression tests** for recursive acceptance, future child creation, recursion disable, subtree move-out, inherited leave, and explicit-child survival.
- [ ] **Step 2: Reconcile create/revoke sync events** for every list whose effective access changes.
- [ ] **Step 3: Audit labels, keyboard/touch targets, mobile route authorization, and responsive layouts.**
- [ ] **Step 4: Update user/domain docs** with the stable contract and Drive-style accessible hierarchy.
- [ ] **Step 5: Run format, lint, Knip, React Doctor, typecheck, OpenAPI, shared/TRPC/workers/E2E tests.**
- [ ] **Step 6: Review CodeRabbit findings against current code and resolve only still-valid issues.**
- [ ] **Step 7: Verify the branch is current with `main`, update the PR description with validation evidence, and keep merge as an explicit user action.**
