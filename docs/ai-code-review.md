# AI code review policy

This repository uses multiple AI-assisted pull request reviewers as advisory engineering tools. They supplement, but do not replace, GitHub Actions, tests, issue/spec intent, maintainer judgment, or understanding of the existing codebase.

The intended reviewer set is:

| Reviewer | Role |
| --- | --- |
| CodeRabbit | Broad repository-aware review and trusted baseline |
| Qodo | Correctness, issue/spec fulfillment, tests, authorization/security |
| Sourcery | Maintainability, design, performance, code quality, security, issue fulfillment |
| Graphite Agent | Logic bugs, edge cases, regressions, performance, security |

The operating principle is simple:

> Four independent critics, zero autonomous fixers.

## Free-plan and open-source access

The rollout must stay at zero paid subscription cost for the intended repository usage.

- **Qodo:** use Qodo's qualified open-source program. Qodo's general commercial pricing is not the basis for this rollout, so complete any OSS qualification/application step required by Qodo before treating the integration as permanently free.
- **Sourcery:** use its free open-source repository access. Do not add paid-only functionality to the rollout.
- **Graphite Agent:** use the free Hobby plan for this personal repository. AI reviews are limited on Hobby and review customization is not included, so Graphite must remain a best-effort bonus reviewer rather than a dependency.
- **CodeRabbit:** preserve the repository's existing working setup.

If a vendor changes its plan or the repository no longer qualifies for the expected free/open-source access, do not silently start a paid subscription. Re-evaluate the reviewer or remove it.

## Review authority

An AI review comment is evidence of a possible problem. It is not an instruction to change the code.

Before acting on a substantive AI finding, verify it against the strongest available sources of truth:

1. the originating issue, approved spec, or explicit maintainer decision;
2. surrounding code and established behavior;
3. tests that encode externally observable behavior or invariants;
4. repository documentation and agent instructions;
5. actual runtime, API, data-flow, authorization, database, and deployment semantics where relevant.

Agreement between multiple reviewers increases the priority of investigation, but it does not prove the finding is correct.

### Behavior-changing suggestions

Do not implement a reviewer suggestion automatically if it would materially change any of these areas unless the issue/spec clearly requires the change:

- user-visible functionality or UX flow;
- authentication, authorization, viewer/editor/owner, sharing, or other permission behavior;
- deletion, retention, ownership, persistence, or lifecycle semantics;
- API contracts;
- database constraints, migrations, or data interpretation;
- compatibility behavior or upstream-sync assumptions;
- deployment/runtime architecture or operator behavior;
- intentionally chosen edge-case behavior.

If issue/spec/code/tests/docs do not resolve the intended behavior, ask the maintainer instead of changing the code merely to satisfy a reviewer.

## Hard review-only rule

The reviewer setup must never automatically modify repository code.

Do not enable:

- automatic commits;
- automatic pushes;
- automatic application of code suggestions;
- reviewer-driven coding/fixing agents;
- workflows that turn review comments into patches automatically;
- AI auto-approval as merge authority;
- reviewer-driven branch mutations.

Inline GitHub suggestion blocks are allowed because a human or coding agent must still choose to apply them deliberately.

## Merge and CI policy

AI review remains advisory.

- Do not make an AI reviewer a required merge check solely because it is an AI reviewer.
- Do not require a minimum number of AI approvals.
- Do not require every AI thread to be mechanically resolved before merge.
- Do not let a free-tier quota become a merge dependency.
- Do not replace deterministic CI with AI judgment.

GitHub Actions remains authoritative for deterministic validation such as formatting, linting, typechecking, tests, generated-artifact checks, Knip, React Doctor, and other repository CI checks.

Serious AI findings should still be investigated. Advisory means the reviewer cannot become authority by itself, not that review feedback should be ignored.

## Pull request scope

The intended default is:

- review non-draft pull requests targeting `main`;
- skip draft PRs until they are ready for review;
- treat coding-agent-authored implementation PRs like normal PRs;
- avoid wasting all four reviewers on pure dependency-bot PRs;
- keep deterministic CI independent from the AI review layer.

CodeRabbit already automatically reviews non-draft PRs targeting `main`.

Sourcery currently skips drafts and dependency-bot PRs by default. It also performs lighter re-reviews after pushes rather than recreating the entire review every time, with a cap on automatic re-reviews.

Qodo is configured for automatic review only. Full re-review should be requested deliberately when useful after meaningful changes rather than deliberately running extra reviewer features on every small update.

Graphite uses its native free-tier automatic AI review behavior for this personal repository.

## Noise control

AI review should focus on substantive engineering problems:

- correctness and logic bugs;
- regressions and edge cases;
- authorization, privacy, and security issues;
- data-loss or lifecycle risks;
- meaningful test gaps;
- maintainability/design issues with real impact;
- performance problems;
- unimplemented issue/spec requirements.

Avoid duplicating formatter/linter/typechecker output or producing generic style advice without demonstrated impact.

The existing CodeRabbit generated-artifact exclusions are the reference set where equivalent controls are available:

- `packages/open-api/karakeep-openapi-spec.json`
- `packages/sdk/src/karakeep-api.d.ts`
- `packages/db/drizzle/meta/**`

Do not add unrelated repository-wide generated-file behavior merely to satisfy an AI reviewer.

## Qodo

Repository policy is source-controlled in `.pr_agent.toml`.

The automatic command list intentionally contains only the current Qodo agentic review command. Automatic describe/improve tooling is not part of the reviewer workflow.

The inline severity threshold is `2`, so `remediation_recommended` and `action_required` findings can be published inline while informational-only findings do not dominate the PR.

Qodo is instructed to:

- review against linked GitHub issue/spec intent;
- prioritize correctness, regression, auth/security, lifecycle/data-loss, and meaningful test problems;
- preserve existing intentional semantics unless the issue/spec changes them;
- avoid generic behavior-changing "improvements";
- avoid low-value format/naming/style duplication.

Qodo can use GitHub Issues referenced in the PR body as review context. Keep implementation PRs explicitly linked to their issue when possible.

### Qodo configuration timing

Repository-root `.pr_agent.toml` configuration takes effect from the default branch for pull requests created after it is merged. Therefore:

- the rollout PR can prove the Qodo GitHub App itself works;
- the next newly created real PR after merge is the definitive test that the source-controlled Qodo policy is active.

Do not use a repository wiki configuration as a hidden bootstrap override. The repository file is the preferred policy source.

Useful Qodo diagnostic command when validating the hosted integration:

```text
/config
```

Use the live configuration output to confirm supported ignore/configuration keys before adding vendor-specific settings that are not already documented for the active hosted version.

## Sourcery

Use Sourcery's hosted GitHub pull-request review integration only. Do not add its CLI, pre-commit hook, CI token, `--fix` workflow, production-issue auto-fix flow, or coding agents to this repository.

Recommended repository settings:

- pull request reviews enabled;
- AI review comments enabled;
- draft reviews disabled;
- `main` as the relevant base branch where supported;
- dependency-bot skip behavior retained;
- redundant summary, reviewer guide, sequence diagrams, and tips/commands disabled where supported so Sourcery primarily contributes independent findings rather than PR decoration;
- repository Path Filters exclude the same generated artifacts already excluded by CodeRabbit:
  - `packages/open-api/karakeep-openapi-spec.json`
  - `packages/sdk/src/karakeep-api.d.ts`
  - `packages/db/drizzle/meta/**`.

Review Rules should stay small and focused on areas where Sourcery adds a distinct perspective, such as maintainability, design, performance, and preserving intended behavior. Do not copy the entire CodeRabbit ruleset into Sourcery.

Sourcery uses related GitHub Issues as review context and can assess whether linked issue requirements appear implemented.

### Sourcery re-reviews

Sourcery currently re-checks review feedback after new commits. These re-reviews are lighter than the initial review and automatically capped. Do not add another automation on top of that. Request a manual full review only when useful after substantial changes.

### Teaching Sourcery

Sourcery review comments expose positive/negative feedback controls. During the calibration period:

- mark useful, correct findings positively;
- mark incorrect, irrelevant, or unwanted findings negatively.

Use this consistently so future reviews better match the repository's needs.

## Graphite Agent

Use Graphite AI Reviews through the Graphite GitHub App, scoped only to this personal repository.

The free Hobby plan currently provides limited AI reviews for personal repositories. Hobby does not include AI review customization, filters, or custom rules, so Graphite is intentionally treated as a bonus independent reviewer using its defaults.

Graphite quota must never become a merge dependency.

If the free quota later becomes restrictive, the maintainer can separately investigate Graphite's open-source access/sponsorship path.

Do not enable or depend on separate Graphite coding-agent functionality as part of this reviewer setup.

## CodeRabbit

CodeRabbit remains the broad, repository-aware baseline reviewer configured by `.coderabbit.yaml`.

Its existing configuration should not be changed merely to accommodate the other reviewers. CodeRabbit is more trusted in this repository because it has already been used in practice, but it still follows the same evidence-not-authority rule as every other AI reviewer.

## Permissions and installation scope

Prefer vendor-hosted GitHub Apps over new AI GitHub Actions workflows, API keys, or repository secrets.

Install each reviewer only for `absolutepraya/karakeep`, not all repositories on the account.

Reasonable permissions include:

- repository contents: read;
- pull requests/reviews/comments: write when required to publish review feedback;
- issues/comments: write only when required for supported review interaction;
- checks/statuses: read/write when required to publish review state;
- metadata: read.

Stop and get explicit maintainer approval before accepting an App that requests any of the following beyond what is necessary for review:

- repository contents: write;
- GitHub Actions/workflows: write;
- repository administration;
- secrets/environments;
- equivalent broad code-mutation privileges.

If a reviewer cannot operate within the review-only safety model on its available free/open-source tier, skip that reviewer instead of weakening the policy.

## Probation and finding classification

Treat Qodo, Sourcery, and Graphite as probationary for roughly 10 to 20 real PRs.

Classify substantive findings as:

1. **Confirmed defect**: evidence shows the problem is real and within intended scope. Fix it.
2. **Valid but optional**: technically reasonable but outside the requested scope. Normally leave it out of the PR.
3. **Intentional behavior**: the reviewer misunderstood a deliberate choice. Reject it and provide negative feedback where supported.
4. **False positive**: the claim does not hold after inspection. Reject it and provide negative feedback where supported.
5. **Ambiguous or behavior-changing**: the proposed change could alter intended semantics and the available sources do not resolve intent. Ask the maintainer.

After roughly 10 to 20 real PRs, compare each reviewer by:

- unique actionable findings;
- false-positive rate;
- redundant noise;
- operational friction;
- quota/plan constraints.

Retune or remove reviewers that add little value.

## Manual reviewer interaction

Use manual re-review commands only when they add value after meaningful changes.

Current examples:

```text
@coderabbitai review
@sourcery-ai review
```

For Qodo, use the command surface shown by the active hosted integration and `/config` when validating settings rather than assuming old Qodo/PR-Agent command behavior.

## Maintainer rollout checklist

For a new reviewer installation:

1. Open a real implementation PR first so there is a test target.
2. Confirm the intended free/open-source plan is active or that the required OSS application/qualification step has been completed.
3. Start the vendor GitHub App installation.
4. Select only `absolutepraya/karakeep`.
5. Inspect the exact requested permissions.
6. Stop if the permission ceiling is exceeded.
7. Enable review-only behavior.
8. Confirm the reviewer comments on the test PR.
9. Confirm it does not commit, push, or automatically apply changes.
10. Keep the reviewer advisory and non-required.
11. Record any vendor-specific limitation discovered during setup.

## Design and implementation history

The rationale and complete approved decisions for the four-reviewer rollout are preserved in:

- `docs/superpowers/specs/2026-08-15-ai-reviewer-army-design.md`
- `docs/superpowers/plans/2026-08-15-ai-reviewer-army.md`

## Vendor references

These vendor behaviors change over time. Re-check official docs before changing the integration:

- Qodo pricing/open-source access: <https://www.qodo.ai/pricing/>
- Qodo open-source program: <https://www.qodo.ai/solutions/open-source/>
- Qodo configuration: <https://docs.qodo.ai/qodo-documentation/code-review/get-started/configuration-overview/configuration-file>
- Qodo GitHub issue integration: <https://docs.qodo.ai/code-review/integrations/ticketing-integrations/github>
- Qodo ignore/content controls: <https://docs.qodo.ai/code-review/concepts/ignore-content-from-analysis>
- Sourcery reviews: <https://docs.sourcery.ai/reviews/>
- Sourcery review settings: <https://docs.sourcery.ai/reviews/configure/>
- Sourcery review rules: <https://docs.sourcery.ai/reviews/review-rules/>
- Sourcery review anatomy: <https://docs.sourcery.ai/reviews/anatomy-of-a-review/>
- Graphite AI review setup: <https://graphite.com/docs/ai-reviews-setup>
- Graphite customization: <https://graphite.com/docs/ai-review-customization>
- Graphite plans: <https://graphite.com/docs/billing-plans>
