# Stable List Collaboration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Graduate manual-list collaboration from Beta to stable across web and mobile, including 30-day invitations, truthful/resendable email, and opt-in recursive nested-list access.

**Architecture:** Store `recursive` only on direct invitations and collaborator memberships. Resolve effective access at read/authorization time from the exact-list grant first and then the nearest ancestor recursive grant, so future descendants inherit automatically without materialized child memberships. Keep invitation lifecycle and email delivery separate so a committed invitation is never rolled back by SMTP behavior.

**Tech Stack:** TypeScript, tRPC, Drizzle ORM, SQLite, Next.js/React, React Native/Expo, TanStack Query, Vitest.

## Global Constraints

- Collaboration remains manual-list only.
- Existing registered users only; normalize email and avoid account-enumerating error copy.
- Invitation expiry is exactly 30 days from `invitedAt`; resend resets `invitedAt`.
- `Also share all nested lists` defaults off.
- Public-list access remains independent and read-only.
- Viewer is read-only; editor edits bookmark memberships; owner alone manages metadata/collaborators.
- Recursive access includes current/future descendants and disappears when a list leaves the ancestor subtree.
- Exact-list direct grants win over inherited grants. Otherwise nearest recursive ancestor wins.
- No durable email outbox, ownership transfer, comments/activity feed, or real-time editing.

---

### Task 1: Persist direct recursive grants and resolve effective access

**Files:**
- Modify: `packages/db/schema.ts`
- Create: next Drizzle migration under `packages/db/migrations/`
- Modify: `packages/trpc/models/lists.ts`
- Modify/Test: `packages/trpc/routers/sharedLists.test.ts`

**Interfaces:**
- `listCollaborators.recursive: boolean` defaults `false`.
- `listInvitations.recursive: boolean` defaults `false`.
- Effective collaborator resolution returns the direct membership row used for contribution ownership when access is direct; inherited access has no descendant membership row.

- [ ] **Step 1: Add failing backend tests** proving: direct access works; recursive ancestor grants current descendants; a future/moved-in descendant becomes accessible without new membership rows; moving out removes inherited access; nearest recursive ancestor wins; exact-list direct role wins; viewer inherited access cannot edit; editor inherited access can edit.
- [ ] **Step 2: Run focused TRPC tests** with `pnpm --filter @karakeep/trpc test -- sharedLists.test.ts` and confirm the new cases fail because recursive fields/resolution do not exist.
- [ ] **Step 3: Add schema columns + migration** using integer boolean columns with `NOT NULL DEFAULT 0` so existing memberships remain non-recursive.
- [ ] **Step 4: Implement centralized effective-access resolution** in `packages/trpc/models/lists.ts`: owner first; exact direct membership second; nearest ancestor membership with `recursive=true` third. Keep collaborator-visible `parentId` private.
- [ ] **Step 5: Make list enumeration include inherited shared lists** while preserving the existing Shared Lists client grouping and without leaking inaccessible siblings/parents.
- [ ] **Step 6: Run the focused tests again** and confirm all recursive authorization cases pass.
- [ ] **Step 7: Commit** `feat: add recursive list collaboration permissions`.

### Task 2: Stabilize invitation lifecycle and email delivery

**Files:**
- Modify: `packages/trpc/models/listInvitations.ts`
- Modify: `packages/trpc/models/lists.ts`
- Modify: `packages/trpc/routers/lists.ts`
- Modify: `packages/trpc/email.ts`
- Modify/Test: `packages/trpc/routers/sharedLists.test.ts`

**Interfaces:**
- Invitation create/update accepts `{ email, role, recursive }`.
- Pending invitation validity: `Date.now() - invitedAt < 30 days`.
- Resend returns delivery result and renews `invitedAt`.
- Accept copies both role and recursive to `listCollaborators`.

- [ ] **Step 1: Add failing lifecycle tests** for normalized emails, neutral unknown-user failures, 30-day expiry, expired accept rejection, declined reinvite, pending role change, pending recursive-scope change, resend renewal, and accepted `recursive` persistence.
- [ ] **Step 2: Add failing email tests** proving invitation creation survives absent/failing SMTP, delivery state is distinguishable, deep links contain invitation ID, and HTML escapes list/inviter names.
- [ ] **Step 3: Run focused TRPC/email tests** and confirm failures reflect the missing stable lifecycle.
- [ ] **Step 4: Implement lifecycle helpers** for expiry, role/scope updates, declined reinvite, resend, and normalized email lookup. Return neutral public errors for unknown users.
- [ ] **Step 5: Move email send outside the invitation DB transaction** and return a structured delivery result instead of claiming `sent` unconditionally.
- [ ] **Step 6: Escape HTML and build invitation-ID deep links** while keeping plain-text output.
- [ ] **Step 7: Run focused tests** and confirm lifecycle/email cases pass.
- [ ] **Step 8: Commit** `feat: stabilize list invitation lifecycle`.

### Task 3: Align web collaboration UI with stable semantics

**Files:**
- Modify/Test: `apps/web/components/dashboard/lists/ManageCollaboratorsModal.tsx`
- Modify/Test: `apps/web/components/dashboard/lists/PendingInvitationsCard.tsx`
- Modify: `apps/web/components/dashboard/sidebar/InvitationNotificationBadge.tsx`
- Modify/Test: `apps/web/components/dashboard/bookmarks/BookmarkOptions.tsx`
- Modify relevant web translation resources used by these components.

**Interfaces:**
- Owner management consumes collaborator rows with accepted/pending state, role, recursive scope, expiry, and invitation ID.
- Mutations: invite, update accepted role/scope, update pending role/scope, resend, revoke, remove.

- [ ] **Step 1: Add failing component tests** for viewer removal-action hiding, recursive checkbox default-off copy, pending role/scope updates, expired state, resend feedback, and removal confirmation copy.
- [ ] **Step 2: Run focused web tests** and confirm the new UI-contract tests fail.
- [ ] **Step 3: Update Manage Collaborators**: remove Beta; add default-off `Also share all nested lists`; show current/future nested-list helper copy; expose role and recursive scope for accepted/pending entries; show expired pending state; add Resend and Revoke; confirm collaborator removal and explain contributed bookmark-list entries vs underlying bookmarks.
- [ ] **Step 4: Make creation/resend toasts truthful**: distinguish invitation created + email sent from invitation created + email not sent.
- [ ] **Step 5: Fix bookmark option visibility** so viewer-only users never see Remove from list even when they own the underlying bookmark.
- [ ] **Step 6: Make pending-invitation inbox/deep-link handling target invitation IDs** and handle expired/declined/revoked states gracefully.
- [ ] **Step 7: Run focused web tests** and confirm pass.
- [ ] **Step 8: Commit** `feat(web): graduate list collaboration UI`.

### Task 4: Add full native-mobile collaboration parity

**Files:**
- Modify: `apps/mobile/app/dashboard/(tabs)/(lists)/index.tsx`
- Modify: `apps/mobile/app/dashboard/lists/[slug]/index.tsx`
- Create mobile invitation inbox/management routes and focused reusable components under the existing `apps/mobile` conventions.
- Add focused mobile tests where the repository has an established test seam; otherwise typecheck is the executable gate and the behavioral contract remains covered at TRPC level.

**Interfaces:**
- Mobile uses the same tRPC invitation/collaborator procedures as web.
- Owner list actions add Manage Collaborators; collaborator list actions keep Leave List.

- [ ] **Step 1: Add the pending-invitation entry point** on the Lists tab with count/badge and a screen listing invitation, owner/list, role, recursive scope, expiry, Accept and Decline.
- [ ] **Step 2: Add owner Manage Collaborators navigation** to the list actions menu.
- [ ] **Step 3: Build the mobile management screen** with invite email, role selector, default-off nested-list toggle, accepted/pending entries, role/scope updates, resend/revoke, and confirmed removal.
- [ ] **Step 4: Invalidate list/invitation/collaborator queries** after all mutations so native state updates immediately.
- [ ] **Step 5: Preserve role-aware behavior**: viewers remain read-only, editors can modify bookmark membership, owner-only management remains hidden from collaborators.
- [ ] **Step 6: Run `pnpm --filter @karakeep/mobile typecheck` plus available focused mobile tests.**
- [ ] **Step 7: Commit** `feat(mobile): add stable list collaboration management`.

### Task 5: Regression coverage, docs, accessibility, and GA cleanup

**Files:**
- Modify: collaboration/user documentation discovered by repo search.
- Modify: `CONTEXT.md` only if implementation terminology differs from the approved model.
- Modify/add tests around offline/shared-list revocation behavior where existing seams exist.

**Interfaces:**
- Stable collaboration docs describe roles, recursive scope, invitation expiry/resend, mobile parity, public-vs-collaborator access, and intentional limitations.

- [ ] **Step 1: Add regression tests** for collaborator avatar privacy (accepted only), concurrent invitation terminal states, removal/leave contribution cleanup, and offline/shared-list disappearance after revocation on sync.
- [ ] **Step 2: Audit collaboration controls for labels, keyboard/touch usability, and responsive layouts** on web/mobile.
- [ ] **Step 3: Update user/contributor docs** with the stable contract and intentional non-goals.
- [ ] **Step 4: Run formatting/lint/typecheck/focused tests**: `pnpm format:fix`, `pnpm lint`, `pnpm typecheck`, TRPC collaboration tests, focused web tests, mobile typecheck.
- [ ] **Step 5: Run repository preflight/full CI-equivalent checks** required by `AGENTS.md` where practical.
- [ ] **Step 6: Review the final diff against issue #24** and verify every stable blocker is either implemented or explicitly documented as an intentional limitation.
- [ ] **Step 7: Commit** `docs: document stable list collaboration` and open the PR with `Closes #24`.
