# AI Reviewer Army Live Rollout Plan

This companion plan supplements `2026-08-15-ai-reviewer-army.md` with the current vendor-access and dashboard details discovered during final verification. The main plan remains the repository implementation plan; this file is the authoritative checklist for the maintainer-assisted hosted-service setup.

**Related issue:** #40

**Canonical policy:** `docs/ai-code-review.md`

**Design:** `docs/superpowers/specs/2026-08-15-ai-reviewer-army-design.md`

## Non-negotiable safety model

- Each reviewer is a critic only.
- No automatic commits, pushes, applied fixes, reviewer-driven coding agents, or branch mutation.
- AI comments are evidence to verify, never authority over issue/spec intent or established behavior.
- No AI reviewer is a required merge gate.
- Install each App only for `absolutepraya/karakeep`.
- Stop and ask the maintainer before accepting repository-content write, Actions/workflow write, administration, secrets/environments, or equivalent broad code-mutation privileges.
- Use only free/open-source access. Never silently start a paid subscription.

## Access model

### Qodo

The intended zero-cost route is Qodo's qualified open-source program, not an assumption that its normal commercial offering has a permanent unrestricted free tier.

Before relying on Qodo as part of the permanent reviewer set:

- confirm `absolutepraya/karakeep` qualifies for Qodo's open-source program;
- complete any Qodo OSS application or qualification step that is currently required;
- do not begin a paid subscription if the OSS program is unavailable or rejected;
- if free OSS access cannot be obtained, leave Qodo out rather than weakening the zero-cost requirement.

### Sourcery

Use Sourcery's free open-source repository access. Do not add paid-only functionality to the required rollout.

### Graphite

Use the free Hobby plan for this personal repository. Hobby AI reviews are limited and review customization is not included, so Graphite remains best-effort and non-blocking.

## Qodo setup

1. Start the Qodo GitHub/Open Source onboarding flow and confirm free OSS eligibility.
2. Select only `absolutepraya/karakeep` when installing the GitHub App.
3. Inspect the requested permissions before authorization. Stop if they exceed the policy ceiling.
4. Confirm the implementation PR receives a Qodo review.
5. Run `/config` in the PR when needed to inspect the active hosted configuration surface.
6. Confirm the automatic command set is review-only. Do not enable automatic improve, describe, auto-approval, or coding-agent fixes.
7. Do not use repository-wiki configuration as a hidden bootstrap override.
8. Repository-root `.pr_agent.toml` becomes effective from the default branch for newly created PRs after merge, so validate the merged config on the next new real PR.
9. The desired generated-artifact exclusions are:
   - `packages/open-api/karakeep-openapi-spec.json`
   - `packages/sdk/src/karakeep-api.d.ts`
   - `packages/db/drizzle/meta/**`
10. Do not copy older Qodo/PR-Agent v1 glob syntax into the current Qodo 2 config unless the live `/config` output or current official docs confirm the supported mechanism. If current Qodo 2 cannot express these exclusions cleanly, document that limitation rather than guessing.

## Sourcery setup

1. Confirm the repository is on Sourcery's free open-source access.
2. Connect only `absolutepraya/karakeep`.
3. Inspect GitHub App permissions before authorization and stop if the ceiling is exceeded.
4. In repository Review Settings:
   - enable pull-request reviews;
   - keep AI review comments enabled;
   - keep draft reviews disabled;
   - limit the relevant base branch to `main` where supported;
   - preserve dependency-bot skipping;
   - disable redundant PR summary, reviewer guide, sequence diagrams, and tips/commands where supported so Sourcery primarily contributes findings rather than duplicate decoration.
5. Configure repository Path Filters for the agreed generated artifacts:
   - `packages/open-api/karakeep-openapi-spec.json`
   - `packages/sdk/src/karakeep-api.d.ts`
   - `packages/db/drizzle/meta/**`
6. Add only a small number of distinct Review Rules if useful, focused on maintainability, design, performance, and preserving intended behavior. Do not duplicate the entire CodeRabbit ruleset.
7. Confirm Sourcery reviews the implementation PR.
8. Do not enable Sourcery CLI `--fix`, production-issue auto-fix agents, or another mutation path.
9. Accept Sourcery's native lightweight capped re-review behavior after pushes. Do not add a second automation for it.
10. During the 10 to 20 PR probation period, use positive/negative feedback reactions consistently on useful versus incorrect/noisy findings.

## Graphite setup

1. Install/authenticate the Graphite GitHub App for the personal account and select only `absolutepraya/karakeep`.
2. Inspect requested permissions and stop if the policy ceiling is exceeded.
3. Enable Graphite AI Reviews for this repository under the free Hobby plan.
4. Confirm Graphite Agent reviews the implementation PR.
5. Do not enable separate coding-agent functionality as part of this reviewer rollout.
6. Do not depend on Graphite-specific custom rules or file filters because Hobby review customization is not included.
7. Never make Graphite's limited review quota a merge dependency.
8. If the Hobby quota later becomes restrictive, separately investigate Graphite open-source access/sponsorship rather than converting this rollout into a paid dependency without an explicit decision.

## CodeRabbit regression check

- Confirm the existing CodeRabbit App still reviews the implementation PR normally.
- Keep `.coderabbit.yaml` unchanged unless a real integration conflict is discovered.
- The same evidence-not-authority rule applies even though CodeRabbit has already earned more practical trust in this repository.

## Live smoke-test acceptance criteria

Before calling the hosted-service rollout successful:

- Qodo reviews the PR through confirmed free OSS access, or is explicitly left out because OSS access is unavailable;
- Sourcery reviews the PR through free OSS access;
- Graphite reviews the PR through Hobby/free access;
- CodeRabbit continues working;
- each App is scoped only to this repository;
- no App required permissions above the approved ceiling;
- none of the services automatically commits, pushes, applies fixes, or mutates the branch;
- all reviewer status/check output remains advisory;
- obvious duplicate/noisy behavior is documented and tuned only where the current free plan supports it;
- no application, database, deployment, CI, or runtime behavior is changed merely to satisfy a reviewer.

## Post-merge validation

After an explicit maintainer merge:

1. Validate `.pr_agent.toml` on the next newly created real PR targeting `main`.
2. Begin the 10 to 20 PR probation period for Qodo, Sourcery, and Graphite.
3. Classify findings as confirmed defect, valid-but-optional, intentional behavior, false positive, or ambiguous/behavior-changing.
4. Escalate ambiguous behavior-changing suggestions rather than implementing them automatically.
5. Compare reviewers by unique actionable findings, false positives, redundant noise, operational friction, and free-plan constraints.
6. Retune or remove low-value reviewers after the calibration period.
