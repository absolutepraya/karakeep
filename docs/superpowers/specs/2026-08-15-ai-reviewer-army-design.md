# AI Reviewer Army Design

## Goal

Add Sourcery and Graphite Agent alongside the existing CodeRabbit setup so pull requests can receive three independent AI review signals without allowing any AI reviewer to modify the codebase autonomously or become an authoritative merge gate.

This design implements issue #40 and records the decisions made during the design interview so future maintainers and coding agents do not need the original conversation to reconstruct intent.

The operating principle is:

> Three independent critics, zero autonomous fixers.

## Why three reviewers

CodeRabbit is already enabled and trusted as the repository's broad, repository-aware AI reviewer. Additional independent reviewers can still catch different logic bugs, edge cases, regressions, maintainability issues, performance problems, security concerns, and issue/spec omissions.

Some redundancy is expected and acceptable, but reviewer count is not itself a goal. The setup must stay free, low-friction, review-only, and useful. Qodo was explicitly removed from this rollout after confirming its permanent-zero-cost path requires qualifying/applying for its open-source program. That administrative dependency does not fit the desired "install and keep using the free plan" model.

## Reviewer set and roles

| Reviewer | Intended role |
| --- | --- |
| CodeRabbit | Broad repository-aware semantic review and trusted baseline |
| Sourcery | Maintainability, design, code quality, performance, security, and issue/spec fulfillment |
| Graphite Agent | Logic bugs, edge cases, regressions, performance, and security using free-tier defaults |

These are specialization goals, not exclusive ownership boundaries. Reviewers may overlap. Independent agreement increases investigation priority but never converts a claim into truth automatically.

## Authority model

AI review comments are evidence of a possible problem, not requirements and not instructions to change the implementation.

For every substantive finding, verify the claim against the strongest available sources of truth:

1. the originating GitHub issue, approved spec, or explicit maintainer decision;
2. surrounding code and established existing behavior;
3. tests that encode externally observable behavior or invariants;
4. repository documentation and agent instructions;
5. actual runtime, API, data-flow, authorization, database, and deployment semantics where relevant.

A reviewer suggestion must not be implemented automatically merely because it sounds reasonable or because multiple reviewers agree with it.

If a proposed fix would materially change any of the following and the issue/spec does not clearly require that change, treat it as an unresolved product/design decision instead of silently implementing it:

- user-visible functionality or UX flow;
- authentication, authorization, sharing, viewer/editor/owner, or other permission semantics;
- deletion, retention, lifecycle, ownership, or persistence behavior;
- public or internal API contracts;
- database constraints, migration semantics, or data interpretation;
- compatibility behavior or upstream-sync assumptions;
- deployment/runtime architecture or operator behavior;
- intentionally selected edge-case behavior.

When intent remains ambiguous after inspection, escalate to the repository owner instead of "fixing" the code to satisfy a reviewer.

## Hard review-only safety rule

All three reviewers are critics only.

The rollout must not add or enable:

- automatic commits;
- automatic pushes;
- automatic application of code suggestions;
- autonomous coding/fixing agents acting on reviewer findings;
- workflows that turn review comments into patches automatically;
- automatic approvals used as merge authority;
- reviewer-driven branch mutations.

Inline review comments and GitHub suggestion blocks are acceptable because applying them remains a deliberate human/agent action.

For Sourcery, use the pull-request review product only. Do not add CLI `--fix`, production-issue auto-fix, or another code-mutation flow.

For Graphite, enable AI Reviews only. Separate coding-agent functionality is outside this rollout.

## Pull request scope

The desired baseline behavior is:

- automatically review non-draft pull requests targeting `main`;
- drafts are skipped until ready for review;
- coding-agent-authored implementation PRs are normal PRs and should receive AI review;
- pure dependency-bot PRs should not consume every reviewer;
- deterministic GitHub Actions remain independent and authoritative for machine-checkable validation.

CodeRabbit already follows the non-draft `main` behavior.

Sourcery's current behavior aligns well with the design: drafts and dependency-bot PRs can be skipped, and its post-push re-reviews are lighter/capped rather than full fresh reviews on every small commit.

Graphite Agent should use the native automatic AI review behavior available on its free Hobby plan.

## Noise-control policy

The reviewer army exists to find substantive engineering problems, not to duplicate formatters, linters, typecheckers, or deterministic tests.

High-value categories include:

- correctness and logic bugs;
- regressions and edge cases;
- authorization, privacy, and security problems;
- missing validation and meaningful test coverage gaps;
- maintainability and design concerns with real engineering impact;
- performance problems;
- issue/spec requirements that appear unimplemented.

Low-value categories should be minimized where controls exist:

- formatting already handled by the repo formatter;
- naming/style preferences already covered by linting or established conventions;
- generic "best practice" suggestions without demonstrated impact;
- comments on generated artifacts whose sources are reviewed elsewhere;
- duplicate PR summaries/decoration that add little review signal.

The existing CodeRabbit generated-artifact exclusions remain the reference set:

- `packages/open-api/karakeep-openapi-spec.json`
- `packages/sdk/src/karakeep-api.d.ts`
- `packages/db/drizzle/meta/**`

Apply the same path filters in Sourcery. Graphite Hobby does not provide the customization needed to mirror them, so do not make paid customization a dependency.

## Sourcery design

Use Sourcery's hosted GitHub integration for automatic PR reviews on this public open-source repository.

Use free open-source access only. No Sourcery CLI, pre-commit hook, GitHub Actions workflow, token, or auto-fix flow should be added.

Configure Sourcery to focus on inline AI review findings. Disable redundant summary/reviewer-guide/sequence-diagram/tips output where the current dashboard allows it, because CodeRabbit already provides broad PR summaries.

Keep draft reviews disabled. Keep dependency-bot skipping. Restrict the relevant base branch to `main` where supported.

Add a small number of review rules focused on maintainability, design, performance, security, issue/spec fulfillment, and preservation of intended behavior. Do not copy the full CodeRabbit path-instruction set.

Sourcery can use related GitHub Issues as review context; preserve that behavior.

During calibration, use positive/negative feedback reactions consistently so useful comments are reinforced and incorrect/noisy comments are marked unhelpful.

Accept Sourcery's native lightweight capped re-review behavior after pushes. Do not add another re-review automation.

## Graphite design

Use Graphite Agent AI Reviews through the Graphite GitHub App, scoped only to this personal repository.

Use the free Hobby plan. Hobby supports limited AI reviews but not AI review customization, filters, or custom rules. Graphite is therefore a bonus independent reviewer using vendor defaults.

Its limited quota must never become a dependency for merging. If the free quota becomes restrictive, separately investigate free OSS access/sponsorship or remove Graphite instead of silently converting this rollout into a paid dependency.

Do not enable or depend on separate Graphite coding-agent functionality.

## CodeRabbit relationship

The existing `.coderabbit.yaml` remains intact and CodeRabbit remains the broad, trusted baseline reviewer.

This rollout does not replace or weaken CodeRabbit. It also does not make CodeRabbit authoritative over issue/spec intent. The same evidence-not-authority rule applies to CodeRabbit even though it has already earned more practical trust in this repository.

## Merge and CI policy

All AI reviewers remain advisory.

There must be:

- no required AI-review status check solely because it is an AI reviewer;
- no required minimum count of AI approvals;
- no policy that every AI thread must mechanically be resolved before merging;
- no reviewer quota that can block a pull request;
- no replacement of deterministic CI with AI judgment.

GitHub Actions remains authoritative for deterministic validation such as formatting, linting, typechecking, tests, generated-artifact checks, Knip, React Doctor, and other repository CI checks.

Serious AI findings should still be investigated. Advisory means a bot cannot become authority by itself, not that findings should be ignored.

## Finding classification during probation

Sourcery and Graphite are new to this repository and should be treated as probationary for roughly 10 to 20 real pull requests.

Classify substantive findings into one of these buckets:

1. **Confirmed defect**: evidence shows the finding is real and within intended behavior; fix it.
2. **Valid but optional**: technically reasonable but outside the requested scope; normally do not change the PR for it.
3. **Intentional behavior**: reviewer misunderstood a deliberate semantic or product choice; reject it and provide negative feedback where supported.
4. **False positive**: the factual claim does not hold after inspection; reject it and provide negative feedback where supported.
5. **Ambiguous or behavior-changing**: implementing it could alter intended functionality and intent is not resolved by issue/spec/code/tests/docs; escalate to the owner.

Two or more reviewers independently flagging the same concern increases priority for investigation but does not change the classification rules.

After roughly 10 to 20 real PRs, compare reviewers by unique actionable findings, false-positive rate, redundant noise, operational friction, and free-plan limitations. Retune or remove reviewers that add little value.

## Permission and installation policy

Use vendor-hosted GitHub Apps rather than new repository GitHub Actions workflows, API keys, or AI secrets.

Install each new App for `absolutepraya/karakeep` only rather than granting account-wide access to unrelated repositories.

Reasonable permissions include:

- repository contents: read;
- pull requests/reviews/comments: write when required to publish review feedback;
- issues/comments: write only when required for supported review interaction;
- checks/statuses: read/write when required to publish review state;
- metadata: read.

Stop installation and require explicit maintainer review if an App requests any of these capabilities beyond what is necessary for review:

- repository contents: write;
- GitHub Actions/workflows: write;
- repository administration;
- secrets or environments;
- broad code-mutation capability or equivalent privileges.

If a reviewer cannot satisfy the review-only safety model or acceptable permissions on its free plan, skip that reviewer. A smaller safe reviewer set is preferable to weakening the policy.

## Documentation model

`docs/ai-code-review.md` is the canonical long-lived operator and contributor policy for the multi-reviewer setup.

`CONTRIBUTING.md` contains a concise contributor-facing explanation and link to the canonical document.

`AGENTS.md` contains the agent-facing rule that AI review findings are advisory evidence and must be verified before implementation, especially when they could alter intended behavior.

This design file preserves the rationale and trade-offs that produced the policy. The accompanying implementation and live-rollout plans preserve exact execution steps.

No ADR is required. The reviewer set is deliberately easy to retune or remove, so this decision is not sufficiently hard to reverse.

## Rollout sequence

1. Add the source-controlled design, implementation plan, live-rollout plan, canonical review policy, and concise contributor/agent documentation.
2. Open the implementation PR against `main` and link issue #40.
3. Before installing each GitHub App, inspect its requested permissions against the permission ceiling.
4. Install Sourcery and Graphite for this repository only when their permissions and free-plan behavior are acceptable.
5. Use the implementation PR as the first live integration smoke test.
6. Fix repository-side integration mistakes in the same PR if live review exposes them.
7. Do not merge automatically. Leave the PR for explicit maintainer approval.
8. After merge, begin the 10 to 20 PR probation period.

## Validation requirements

Repository-side validation:

- the branch contains no new AI API key or secret;
- no new AI-review GitHub Actions workflow is added;
- existing CodeRabbit configuration is preserved;
- no Qodo configuration remains in the final diff;
- documentation consistently states review-only, advisory behavior;
- documentation makes issue/spec intent and established behavior authoritative over reviewer suggestions;
- no reviewer is documented as a required merge gate;
- the implementation diff does not alter application, database, deployment, or runtime behavior.

Live integration validation:

- Sourcery can review the implementation PR through free open-source access;
- Graphite Agent can review the implementation PR through Hobby/free access;
- CodeRabbit continues operating normally;
- all new Apps are scoped only to this repository;
- no App required a permission that violates the approved ceiling;
- no service automatically commits, pushes, or applies code changes;
- review output is inspected for obvious duplicate/noisy behavior.

## Out of scope

- Qodo;
- replacing CodeRabbit;
- self-hosted reviewers that require paid LLM API inference;
- automatic AI fixes or coding agents;
- changing branch protection to require AI checks;
- AI-review GitHub Actions workflows;
- vendor API tokens or LLM secrets;
- deterministic CI changes;
- application functionality changes made solely to satisfy reviewer opinions;
- Graphite paid-plan review customization;
- Sourcery production-issue auto-fix or CLI fix flows.
