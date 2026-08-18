# CodeRabbit Automated Review Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a repository-controlled, advisory CodeRabbit review configuration for `absolutepraya/marka` and document the contributor workflow without changing existing CI or deployment behavior.

**Architecture:** CodeRabbit behavior is configured entirely through a root `.coderabbit.yaml`; no GitHub Actions workflow is added. Review policy is split into global review settings, path filters for generated artifacts, path-specific instructions for the major monorepo surfaces, and warning-only built-in pre-merge checks. `CONTRIBUTING.md` documents the human-facing workflow and makes clear that GitHub Actions remains authoritative for deterministic validation.

**Tech Stack:** CodeRabbit GitHub App, CodeRabbit schema v2 YAML, GitHub Checks, Markdown documentation.

## Global Constraints

- Existing `.github/workflows/ci.yml` and `.github/workflows/docker.yml` must remain unchanged.
- Existing CI remains authoritative for lint, format, typecheck, tests, OpenAPI generation checks, Knip, and React Doctor.
- CodeRabbit reviews remain advisory: `reviews.request_changes_workflow: false`.
- Automatic review applies to non-draft PRs targeting the default branch, explicitly including `main`.
- Generated review noise is suppressed only for `packages/open-api/karakeep-openapi-spec.json`, `packages/sdk/src/karakeep-api.d.ts`, and `packages/db/drizzle/meta/**`.
- Lockfiles and dependency changes remain reviewable.
- No secret, token, `.env` value, or production credential may be added to configuration or documentation.
- No redundant CodeRabbit GitHub Actions workflow is added.
- CodeRabbit authorization is performed separately by the maintainer after the implementation PR is ready for review.

---

### Task 1: Add the repository CodeRabbit configuration

**Files:**
- Create: `.coderabbit.yaml`

**Interfaces:**
- Consumes: CodeRabbit schema v2 and the repository architecture described in `AGENTS.md`.
- Produces: the source-controlled automated-review policy consumed by the CodeRabbit GitHub App.

- [ ] **Step 1: Create `.coderabbit.yaml` with the supported baseline settings**

Use this exact global structure:

```yaml
# yaml-language-server: $schema=https://coderabbit.ai/integrations/schema.v2.json

language: en-US

chat:
  auto_reply: true

reviews:
  profile: chill
  request_changes_workflow: false
  high_level_summary: true
  changed_files_summary: true
  poem: false
  review_status: true

  auto_review:
    enabled: true
    drafts: false
    base_branches:
      - main

  tools:
    github-checks:
      enabled: true

  pre_merge_checks:
    docstrings:
      mode: off
    title:
      mode: warning
      requirements: >-
        Use a concise, descriptive title that reflects the actual scope of the change.
    description:
      mode: warning
    issue_assessment:
      mode: warning
```

Rationale: CodeRabbit's current configuration reference supports `profile`, `request_changes_workflow`, summaries, `review_status`, `auto_review`, GitHub Checks, and warning/off pre-merge modes. Docstring coverage is explicitly disabled because this repository does not use it as a merge-quality signal.

- [ ] **Step 2: Add generated-artifact review filters**

Under `reviews`, add:

```yaml
  path_filters:
    - "!packages/open-api/karakeep-openapi-spec.json"
    - "!packages/sdk/src/karakeep-api.d.ts"
    - "!packages/db/drizzle/meta/**"
```

Do not exclude `pnpm-lock.yaml`, migration SQL, generator source code, or dependency manifests.

- [ ] **Step 3: Add web review instructions**

Under `reviews.path_instructions`, add:

```yaml
    - path: "apps/web/**"
      instructions: |
        - Review React/Next.js correctness and client/server boundaries.
        - Check accessibility for interactive UI and icon-only controls.
        - Check responsive and mobile-web behavior.
        - Flag user-visible strings that should use the existing i18n system.
        - Keep changes consistent with the fork's current design language instead of introducing a second style system.
        - Watch for stale React Query cache invalidation after mutations.
        - Avoid unnecessary client-side state and effects when existing patterns are sufficient.
```

- [ ] **Step 4: Add tRPC/backend and database review instructions**

Add:

```yaml
    - path: "packages/trpc/**"
      instructions: |
        - Review authentication and authorization boundaries carefully.
        - Ensure viewer, editor, owner, and similar permission rules are enforced server-side, not only in the UI.
        - Review input validation and error handling.
        - Review transaction boundaries and avoid external network side effects inside database transactions where practical.
        - Check rate limiting where endpoints can be abused.
        - Flag accidental exposure of secrets, private user data, or account-enumeration information.
        - Require meaningful tests for permission, security, or lifecycle changes.

    - path: "packages/db/**"
      instructions: |
        - Review migrations for destructive changes, unsafe cascades, data-loss risk, and rollout compatibility.
        - Check foreign keys, uniqueness constraints, and indexes against intended semantics.
        - Consider compatibility with the fork's rolling web/workers deployment model.
        - Require operator or deploy notes when a schema change needs a controlled rollout.
```

- [ ] **Step 5: Add mobile and browser-extension review instructions**

Add:

```yaml
    - path: "apps/mobile/**"
      instructions: |
        - Review Expo/React Native behavior and platform-specific assumptions.
        - Check touch-target and accessibility behavior.
        - Check navigation and deep-link handling.
        - Keep shared business permissions aligned with web and backend behavior.

    - path: "apps/browser-extension/**"
      instructions: |
        - Review browser permission changes carefully.
        - Check authentication and session assumptions.
        - Avoid exposing secrets or privileged data to extension contexts unnecessarily.
        - Preserve editor/viewer permission behavior when interacting with shared lists or write targets.
```

- [ ] **Step 6: Add CI, deployment, and operator-script review instructions**

Add separate entries so each path uses a documented glob:

```yaml
    - path: ".github/workflows/**"
      instructions: &operator-review |
        - Preserve least-privilege GitHub Actions permissions.
        - Prefer pinned action SHAs, matching the existing workflows.
        - Never expose .env values, tokens, or production credentials.
        - Preserve the fork's pull-based deployment model unless the change explicitly intends to alter it.
        - Call out changes that affect GHCR, Watchtower, production Compose, migrations, or production/local state tooling.

    - path: "deploy/**"
      instructions: *operator-review
    - path: "scripts/**"
      instructions: *operator-review
    - path: "start-dev.sh"
      instructions: *operator-review
    - path: "stop-dev.sh"
      instructions: *operator-review
```

If CodeRabbit's schema rejects YAML aliases in `instructions`, replace aliases with the repeated literal block before committing; do not weaken the rules.

- [ ] **Step 7: Add documentation review instructions**

Add a reusable documentation instruction for the fork's canonical guidance files:

```yaml
    - path: "README.md"
      instructions: &fork-docs-review |
        - Keep fork, development, and deployment facts aligned with the other canonical repository guidance when those facts change.
        - Do not treat upstream Karakeep behavior as authoritative when this fork intentionally diverges.
        - Flag contradictory setup, contributor, deployment, or operator instructions.

    - path: "CONTRIBUTING.md"
      instructions: *fork-docs-review
    - path: "AGENTS.md"
      instructions: *fork-docs-review
    - path: "CLAUDE.md"
      instructions: *fork-docs-review
    - path: "GEMINI.md"
      instructions: *fork-docs-review
    - path: "docs/operator-setup.md"
      instructions: *fork-docs-review
    - path: "docs/docs/**"
      instructions: *fork-docs-review
```

Again, replace aliases with repeated literal blocks if schema validation does not accept aliases.

- [ ] **Step 8: Add test-file review instructions**

Add:

```yaml
    - path: "**/*.test.*"
      instructions: &test-review |
        - Prefer tests that protect externally observable behavior and permission boundaries.
        - Cover meaningful error and edge paths for backend changes where reasonable.
        - Avoid suggestions that only increase test volume without protecting meaningful behavior.

    - path: "**/*.spec.*"
      instructions: *test-review
    - path: "**/tests/**"
      instructions: *test-review
```

- [ ] **Step 9: Validate the configuration shape against current official CodeRabbit documentation**

Verify every configured field exists in the current schema/reference, specifically:

```text
language
chat.auto_reply
reviews.profile
reviews.request_changes_workflow
reviews.high_level_summary
reviews.changed_files_summary
reviews.poem
reviews.review_status
reviews.auto_review.enabled
reviews.auto_review.drafts
reviews.auto_review.base_branches
reviews.path_filters
reviews.path_instructions[].path
reviews.path_instructions[].instructions
reviews.tools.github-checks.enabled
reviews.pre_merge_checks.docstrings.mode
reviews.pre_merge_checks.title.mode
reviews.pre_merge_checks.title.requirements
reviews.pre_merge_checks.description.mode
reviews.pre_merge_checks.issue_assessment.mode
```

Expected result: all fields are present in CodeRabbit schema v2. If YAML anchors are not accepted by schema validation, inline the aliased instruction strings and revalidate.

- [ ] **Step 10: Commit the CodeRabbit configuration**

```bash
git add .coderabbit.yaml
git commit -m "chore: configure CodeRabbit reviews"
```

Expected result: one focused configuration commit, with no workflow files changed.

---

### Task 2: Document the contributor-facing review workflow

**Files:**
- Modify: `CONTRIBUTING.md`, section `## Review expectations`

**Interfaces:**
- Consumes: the advisory behavior implemented by `.coderabbit.yaml`.
- Produces: contributor guidance explaining what automated review does and does not do.

- [ ] **Step 1: Extend `Review expectations` with CodeRabbit guidance**

Replace the current section with wording that preserves the personal-fork review-cadence note and adds these exact facts:

```markdown
## Review expectations

Pull requests targeting `main` may receive an automated CodeRabbit review in addition to the repository's GitHub Actions checks.

During the initial rollout, CodeRabbit is advisory:
- GitHub Actions remains the source of truth for deterministic lint, format, typecheck, test, generated-artifact, Knip, and React Doctor validation.
- CodeRabbit adds contextual review, summaries, repository-specific guidance, and check context; it does not replace CI.
- CodeRabbit does not automatically request changes or act as a required merge gate during this calibration period.
- Contributors can reply to CodeRabbit comments or mention `@coderabbitai` in a PR discussion for follow-up context. A review can be requested explicitly with `@coderabbitai review` when needed.

This is a personal fork, so human review cadence is best-effort rather than community-SLA driven.

If you need a guaranteed path to merge for a generally useful change, upstream Karakeep is usually the better place to propose it.
```

- [ ] **Step 2: Check the documentation against actual configuration**

Confirm:
- no sentence claims CodeRabbit is blocking;
- no sentence says CodeRabbit replaces CI;
- `@coderabbitai` usage matches the enabled `chat.auto_reply` and supported manual review command;
- no installation secret or private configuration is documented.

- [ ] **Step 3: Commit contributor documentation**

```bash
git add CONTRIBUTING.md
git commit -m "docs: document CodeRabbit review workflow"
```

Expected result: contributor docs align with the repository configuration and issue #29.

---

### Task 3: Validate scope, prepare the PR, and perform the live authorization test

**Files:**
- Inspect only: `.github/workflows/ci.yml`
- Inspect only: `.github/workflows/docker.yml`
- Inspect: `.coderabbit.yaml`
- Inspect: `CONTRIBUTING.md`
- Inspect: `docs/superpowers/specs/2026-08-14-coderabbit-review-design.md`
- Inspect: `docs/superpowers/plans/2026-08-14-coderabbit-review.md`

**Interfaces:**
- Consumes: Tasks 1 and 2.
- Produces: a review-ready PR that closes issue #29 and is ready for the maintainer's GitHub App authorization.

- [ ] **Step 1: Compare the branch against `main`**

Expected changed files:

```text
.coderabbit.yaml
CONTRIBUTING.md
docs/superpowers/specs/2026-08-14-coderabbit-review-design.md
docs/superpowers/plans/2026-08-14-coderabbit-review.md
```

Expected unchanged files include:

```text
.github/workflows/ci.yml
.github/workflows/docker.yml
```

No application code, deployment manifests, lockfiles, or generated artifacts should change.

- [ ] **Step 2: Self-review the final diff**

Check:
- automatic reviews are enabled and drafts remain excluded;
- `main` is explicitly listed in `base_branches`;
- `request_changes_workflow` is false;
- summaries, review status, chat auto-reply, and GitHub Checks are enabled;
- only the three agreed generated paths are filtered;
- every major repository surface from issue #29 has path guidance;
- built-in pre-merge checks are warning-only except docstrings, which are off;
- no secret-like values are present;
- contributor docs accurately describe advisory behavior.

- [ ] **Step 3: Update the PR description**

Use a final PR body with these sections:

```markdown
## Description

Adds the repository-side CodeRabbit configuration for advisory automated pull request reviews and documents the contributor workflow.

Closes #29

## What changed

- added a root `.coderabbit.yaml` using CodeRabbit schema v2
- enabled non-draft automatic reviews for PRs targeting `main`
- enabled summaries, review status, mention auto-replies, and GitHub Checks context
- added repository-specific review instructions for web, backend, database, mobile, browser extension, CI/deploy/scripts, docs, and tests
- filtered generated OpenAPI/SDK/Drizzle metadata artifacts from review noise
- added warning-only built-in pre-merge checks while keeping request-changes enforcement disabled
- documented the advisory review workflow in `CONTRIBUTING.md`

## Validation

- checked configuration keys against current official CodeRabbit schema/reference documentation
- reviewed the branch diff to confirm existing CI and Docker deployment workflows are unchanged
- confirmed no secrets or `.env` values are included

## Rollout

CodeRabbit remains advisory during the initial calibration period. Existing GitHub Actions checks remain authoritative for deterministic validation. After this PR is ready for review, the maintainer will install the CodeRabbit GitHub App only for `absolutepraya/marka` and use this PR as the first live review test.
```

- [ ] **Step 4: Mark the PR ready for review**

Expected result: PR is no longer a draft. At this exact point, tell the maintainer to authorize/install CodeRabbit for `absolutepraya/marka`, scoped to this repository only.

- [ ] **Step 5: After authorization, run the live CodeRabbit smoke test**

Expected automatic behavior: CodeRabbit sees a non-draft PR targeting `main` and starts a review using the branch's `.coderabbit.yaml`.

If it does not start automatically, comment:

```text
@coderabbitai review
```

Then inspect CodeRabbit review/check output for configuration errors, unsupported settings, or obvious review noise. Fix any repository-side configuration issue in this same PR and re-run review as needed.

- [ ] **Step 6: Do not merge**

Leave the PR open for maintainer review. Merging remains an explicit maintainer action outside this plan.
