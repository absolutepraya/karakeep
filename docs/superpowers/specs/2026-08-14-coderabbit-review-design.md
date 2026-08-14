# CodeRabbit Automated Review Design

## Goal

Enable CodeRabbit as an advisory automated pull request reviewer for `absolutepraya/karakeep` without changing the role of the existing GitHub Actions CI or the fork's deployment chain.

CodeRabbit will add semantic review, PR summaries, repository-specific guidance, and GitHub review/check context. Existing CI remains authoritative for deterministic validation such as linting, formatting, typechecking, tests, OpenAPI generation checks, Knip, and React Doctor.

## Scope

This change includes the complete repository-side rollout for issue #29:

- add a root `.coderabbit.yaml`
- automatically review non-draft PRs targeting `main`
- keep reviews advisory by leaving request-changes enforcement disabled
- enable high-level and changed-file summaries
- enable review status and GitHub Checks integration
- enable automatic replies when `@coderabbitai` is mentioned
- disable novelty output such as poems
- add repository-specific path instructions for the major code surfaces
- reduce review noise from generated artifacts
- add advisory pre-merge quality checks
- update `CONTRIBUTING.md` with the automated-review workflow

Installing and authorizing the CodeRabbit GitHub App is intentionally outside repository code. The maintainer will install it for this repository after the implementation PR is opened and before that PR is merged, so the PR itself can be used as the first live review test.

## Configuration design

The root `.coderabbit.yaml` is the source-controlled policy for repository review behavior. It will reference CodeRabbit's current v2 schema and use `en-US`.

The initial review profile is `chill`. Automatic reviews are enabled only for non-draft pull requests whose base branch is `main`. `request_changes_workflow` remains `false` so CodeRabbit cannot become a merge blocker during the calibration period.

GitHub Checks integration and `review_status` are enabled so CodeRabbit appears alongside the existing CI checks without introducing a redundant GitHub Actions workflow.

Pre-merge checks are warning-only. The initial checks focus on PR description quality and repo-specific expectations rather than duplicating deterministic CI.

## Repository-aware review instructions

Path instructions will cover these surfaces:

- `apps/web/**`: React/Next.js correctness, client/server boundaries, accessibility, responsive behavior, i18n, design consistency, React Query invalidation, and avoiding unnecessary state/effects
- `packages/trpc/**`: authentication/authorization, validation, error handling, transaction boundaries, abuse/rate limiting, privacy/secrets, and tests for meaningful permission or lifecycle changes
- `packages/db/**`: migration safety, destructive changes, constraints/indexes, rolling deployment compatibility, and operator notes for controlled rollouts
- `apps/mobile/**`: Expo/React Native platform assumptions, touch/accessibility behavior, navigation/deep links, and permission consistency
- `apps/browser-extension/**`: browser permissions, authentication/session handling, privileged-data exposure, and shared-list permission behavior
- `.github/workflows/**`, `deploy/**`, `scripts/**`, `start-dev.sh`, `stop-dev.sh`: least privilege, pinned actions, secret safety, pull-based deployment preservation, and explicit operator-impact review
- repository and workflow documentation: keep fork-specific facts aligned and do not assume upstream behavior is authoritative when this fork intentionally diverges
- test files: prefer externally observable behavior, permission boundaries, and meaningful edge/error coverage over test-volume suggestions

## Generated-file noise

Generated artifacts will be excluded or de-prioritized so CodeRabbit spends review effort on their sources instead:

- `packages/open-api/karakeep-openapi-spec.json`
- `packages/sdk/src/karakeep-api.d.ts`
- `packages/db/drizzle/meta/**`

Lockfiles and dependency changes remain reviewable because they can carry useful dependency and security signal.

## PR quality checks

The initial advisory pre-merge checks should encourage:

- a PR description that explains the change and why it belongs in this fork
- screenshots or a short recording for UI changes when applicable
- migration and deploy/operator notes for schema or backend changes when applicable
- validation commands documented in the PR description
- documentation updates when fork/dev/deploy behavior changes
- no unrelated refactors

These checks are warnings only during the rollout.

## Documentation

`CONTRIBUTING.md` will explain that pull requests may receive automated CodeRabbit review, that findings are advisory during the initial rollout, and that contributors can mention or reply to `@coderabbitai` for follow-up context or review.

No PR-template change is required in this first rollout. That can be reconsidered after the review workflow proves stable.

## CI and deployment invariants

The implementation must not modify `.github/workflows/ci.yml` or `.github/workflows/docker.yml` unless a configuration validation discovery proves a change is strictly required. The expected design requires no workflow change.

The successful-`main`-CI to Docker-build to GHCR to Watchtower flow remains unchanged. CodeRabbit is additive review context only and does not replace or gate the deterministic CI chain.

## Validation

Before opening the PR:

- validate `.coderabbit.yaml` against CodeRabbit's current schema/configuration documentation
- inspect the resulting diff for accidental CI or deployment changes
- confirm generated-file filters do not suppress source files that should remain reviewable
- confirm `CONTRIBUTING.md` accurately describes advisory behavior

After the PR is opened and the GitHub App is installed for `absolutepraya/karakeep`:

- confirm CodeRabbit recognizes the branch configuration
- trigger `@coderabbitai review` if an automatic review does not start for the already-open PR
- inspect the review/check output for configuration errors or excessive noise
- adjust the configuration in the same PR if the first live review exposes obvious issues

## Rollout

Stage A is this PR: repository configuration and contributor documentation, with advisory reviews only.

Stage B happens over subsequent real PRs: observe false positives, tune path instructions and filters, and confirm CodeRabbit understands the fork's architecture and conventions.

Stage C is optional and requires a separate explicit decision: consider request-changes workflow or a required branch/ruleset check only after CodeRabbit proves reliable. Deterministic CI remains required regardless.

## Acceptance criteria

- root `.coderabbit.yaml` exists and matches the current CodeRabbit schema
- non-draft PRs targeting `main` are configured for automatic review
- review summaries, review status, GitHub Checks, and mention auto-replies are enabled
- request-changes enforcement is disabled
- repo-specific path instructions cover web, backend, DB, mobile, browser extension, CI/deploy/scripts, docs, and tests
- generated artifacts do not dominate review output
- no secrets or `.env` values are exposed
- existing CI and deployment workflows are unchanged
- `CONTRIBUTING.md` documents the advisory CodeRabbit workflow
- the GitHub App can be installed after the PR opens and used to review the PR before merge
