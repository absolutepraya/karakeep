# AI Reviewer Army Live Rollout Plan

This companion plan supplements `2026-08-15-ai-reviewer-army.md` with the hosted-service setup details for the final reviewer set.

**Related issue:** #40

**Canonical policy:** `docs/ai-code-review.md`

**Design:** `docs/superpowers/specs/2026-08-15-ai-reviewer-army-design.md`

## Non-negotiable safety model

- Reviewers are critics only.
- No automatic commits, pushes, applied fixes, reviewer-driven coding agents, or branch mutation.
- AI comments are evidence to verify, never authority over issue/spec intent or established behavior.
- No AI reviewer is a required merge gate.
- Install each new App only for `absolutepraya/karakeep`.
- Stop and ask the maintainer before accepting repository-content write, Actions/workflow write, administration, secrets/environments, or equivalent broad code-mutation privileges.
- Use only free access. Never silently start a paid subscription.

## Final reviewer set

- CodeRabbit: existing trusted baseline.
- Sourcery: free open-source review integration.
- Graphite Agent: free Hobby AI Reviews, limited and non-blocking.

Qodo is intentionally excluded. Its permanent zero-cost route requires OSS qualification/application, which does not fit this rollout's low-friction free-plan requirement.

## Sourcery setup

1. Confirm the repository can use Sourcery's free open-source access.
2. Connect only `absolutepraya/karakeep`.
3. Inspect GitHub App permissions before authorization and stop if the policy ceiling is exceeded.
4. In repository Review Settings:
   - enable pull-request reviews;
   - keep AI review comments enabled;
   - keep draft reviews disabled;
   - limit the relevant base branch to `main` where supported;
   - preserve dependency-bot skipping;
   - disable redundant PR summary, reviewer guide, sequence diagrams, and tips/commands where supported.
5. Configure Path Filters for:
   - `packages/open-api/karakeep-openapi-spec.json`
   - `packages/sdk/src/karakeep-api.d.ts`
   - `packages/db/drizzle/meta/**`
6. Add only a small number of distinct Review Rules if useful, focused on maintainability, design, performance, security, issue/spec fulfillment, and preserving intended behavior. Do not duplicate the entire CodeRabbit ruleset.
7. Confirm Sourcery reviews PR #41.
8. Do not enable Sourcery CLI `--fix`, production-issue auto-fix agents, or another mutation path.
9. Accept Sourcery's native lightweight capped re-review behavior after pushes. Do not add a second automation.
10. During the 10 to 20 PR probation period, use positive/negative feedback reactions consistently on useful versus incorrect/noisy findings.

## Graphite setup

1. Install/authenticate the Graphite GitHub App for the personal account and select only `absolutepraya/karakeep`.
2. Inspect requested permissions and stop if the policy ceiling is exceeded.
3. Enable Graphite AI Reviews under the free Hobby plan.
4. Confirm Graphite Agent reviews PR #41.
5. Do not enable separate coding-agent functionality as part of this rollout.
6. Do not depend on Graphite-specific custom rules or file filters because Hobby review customization is not included.
7. Never make Graphite's limited review quota a merge dependency.
8. If the Hobby quota later becomes restrictive, separately investigate free open-source access/sponsorship or remove Graphite rather than silently paying.

## CodeRabbit regression check

- Confirm the existing CodeRabbit App still reviews PR #41 normally.
- Keep `.coderabbit.yaml` unchanged unless a real integration conflict is discovered.
- The same evidence-not-authority rule applies even though CodeRabbit has already earned more practical trust in this repository.

## Live smoke-test acceptance criteria

Before calling the hosted-service rollout successful:

- Sourcery reviews PR #41 through free open-source access;
- Graphite reviews PR #41 through Hobby/free access;
- CodeRabbit continues working;
- each new App is scoped only to this repository;
- no App required permissions above the approved ceiling;
- none of the services automatically commits, pushes, applies fixes, or mutates the branch;
- all reviewer status/check output remains advisory;
- obvious duplicate/noisy behavior is documented and tuned only where the free plan supports it;
- no application, database, deployment, CI, or runtime behavior is changed merely to satisfy a reviewer.

## Post-merge validation

After an explicit maintainer merge:

1. Begin the 10 to 20 PR probation period for Sourcery and Graphite.
2. Classify findings as confirmed defect, valid-but-optional, intentional behavior, false positive, or ambiguous/behavior-changing.
3. Escalate ambiguous behavior-changing suggestions rather than implementing them automatically.
4. Use Sourcery feedback reactions consistently.
5. Compare reviewers by unique actionable findings, false positives, redundant noise, operational friction, and free-plan constraints.
6. Retune or remove low-value reviewers after the calibration period.
