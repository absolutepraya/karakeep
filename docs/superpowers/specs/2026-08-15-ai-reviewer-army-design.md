# AI Reviewer Evaluation Design

## Goal

Preserve the complete design and evaluation history from issue #40 and PR #41, while making the repository's final policy clear:

- CodeRabbit remains the only accepted active AI pull-request reviewer.
- Additional reviewers are desirable only when they are free, useful, review-only, and least-privilege.
- Qodo, Sourcery, and Graphite were evaluated and rejected for this rollout for different reasons.

This file intentionally records both the initial multi-reviewer design and the later live-rollout findings so future maintainers and coding agents do not need the original conversation to reconstruct why the repository did not keep the proposed reviewer army.

## Initial motivation

The original goal was to supplement CodeRabbit with independent review signals so different tools could catch different logic bugs, edge cases, regressions, maintainability issues, performance problems, security concerns, and issue/spec omissions.

The proposed reviewer roles were:

| Reviewer | Intended role |
| --- | --- |
| CodeRabbit | Broad repository-aware semantic review and trusted baseline |
| Qodo | Correctness, issue/spec fulfillment, tests, authorization, and security |
| Sourcery | Maintainability, design, code quality, performance, security, and issue/spec fulfillment |
| Graphite Agent | Logic bugs, edge cases, regressions, performance, and security |

Qodo was removed before live rollout after confirming that its permanent zero-cost route required open-source qualification/application. The planned live set then became CodeRabbit + Sourcery + Graphite.

## Approved authority model

The most important design decision survived the vendor evaluation unchanged:

> AI reviewer comments are evidence of a possible problem, not requirements and not instructions to change the implementation.

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

When intent remains ambiguous after inspection, escalate to the repository owner instead of changing behavior to satisfy a reviewer.

## Hard review-only safety rule

The approved reviewer model was always critics-only.

The rollout must not add or enable:

- automatic commits;
- automatic pushes;
- automatic application of code suggestions;
- autonomous coding/fixing agents acting on reviewer findings;
- workflows that turn review comments into patches automatically;
- automatic approvals used as merge authority;
- reviewer-driven branch mutations.

Inline review comments and GitHub suggestion blocks are acceptable because applying them remains a deliberate human/agent action.

## Merge and CI policy

AI review is advisory.

There must be:

- no required AI-review status check;
- no required minimum count of AI approvals;
- no policy that every AI thread must mechanically be resolved before merging;
- no reviewer quota or outage that can block a pull request;
- no replacement of deterministic CI with AI judgment.

GitHub Actions remains authoritative for deterministic validation such as formatting, linting, typechecking, tests, generated-artifact checks, Knip, React Doctor, and other repository CI checks.

## Noise-control policy

The reviewer experiment was intended to find substantive engineering problems, not duplicate formatters, linters, typecheckers, or deterministic tests.

High-value categories included:

- correctness and logic bugs;
- regressions and edge cases;
- authorization, privacy, and security problems;
- missing validation and meaningful test coverage gaps;
- maintainability and design concerns with real engineering impact;
- performance problems;
- issue/spec requirements that appear unimplemented.

Low-value categories included:

- formatting already handled by the repo formatter;
- naming/style preferences already covered by linting or established conventions;
- generic "best practice" suggestions without demonstrated impact;
- comments on generated artifacts whose sources are reviewed elsewhere;
- duplicate PR summaries/decoration that add little review signal.

The existing CodeRabbit generated-artifact exclusions were the reference set:

- `packages/open-api/karakeep-openapi-spec.json`
- `packages/sdk/src/karakeep-api.d.ts`
- `packages/db/drizzle/meta/**`

## Permission model

The design deliberately treated capability as part of the safety model, not just stated vendor behavior.

Reasonable GitHub App permissions for a reviewer are:

- repository contents: read;
- pull requests/reviews/comments: write when required to publish review feedback;
- issues/comments: write only when required for review interaction;
- checks/statuses: read/write when required to publish review state;
- metadata: read.

The rollout must stop if a candidate requires:

- repository contents: write;
- GitHub Actions/workflows: write;
- repository administration;
- secrets or environments;
- broad code-mutation capability or equivalent privileges.

A vendor may use broad permissions for features outside AI review, but that does not make those permissions acceptable for this repository's review-only threat model.

## Initial rollout design

The approved sequence was:

1. Add source-controlled policy, design, and rollout documentation.
2. Open PR #41 against `main`.
3. Inspect each candidate's pricing and permissions.
4. Install only candidates that met the safety model.
5. Use PR #41 as a live smoke test where possible.
6. Inspect actual review quality before treating a reviewer as trusted.
7. Keep the implementation PR open for explicit maintainer approval.
8. Evaluate new reviewers over 10 to 20 real PRs before deciding whether to keep them.

This design intentionally allowed the final reviewer count to shrink. Reviewer count was never the goal by itself.

## Live evaluation outcome

### Qodo

**Result: rejected before installation.**

Qodo's permanent zero-cost path required open-source qualification/application. The maintainer wanted a low-friction free tier that could be installed and retained without a separate approval process, so Qodo was removed from the rollout.

This was a product/operational fit rejection, not a claim about Qodo review quality.

### Sourcery

**Result: rejected after live installation and smoke test.**

The installation confirmed free open-source access and Sourcery successfully responded to a manual review request on PR #41.

However, GitHub reported the Sourcery App with permissions including:

- repository contents: write;
- Actions: write;
- workflows: write;
- plus the expected review/check/comment permissions.

Those capabilities exceed the approved least-privilege ceiling, so Sourcery fails the repository's safety model even if its PR-review product is configured not to auto-fix.

The first Sourcery review also provided useful calibration evidence:

1. it suggested reducing duplication between the canonical policy, design spec, and plans. That was a reasonable general maintainability preference but intentional for this PR because the maintainer explicitly requested complete durable design and execution knowledge;
2. it claimed `2026-08-15-*` spec/plan filenames were future-dated. The review ran on 2026-08-16, so this was a clear factual false positive.

The quality observations reinforced the evidence-not-authority rule but were not the primary rejection reason. The permission ceiling alone is sufficient.

### Graphite Agent

**Result: rejected during permission evaluation.**

Graphite Hobby met the zero-cost requirement and offered limited AI Reviews, but Graphite's GitHub App permission model includes read/write access to repository contents and Actions/workflows as part of its broader pull-request product.

Those capabilities exceed the approved review-only permission ceiling. The repository therefore does not keep Graphite installed merely because AI Reviews themselves can be operated in a non-mutating mode.

A dedicated long-term review-quality probation was not warranted after the permission failure.

## Final reviewer state

CodeRabbit remains the only accepted active AI reviewer.

The repository does not weaken the permission ceiling to preserve reviewer count.

The operating principle after the experiment is:

> One accepted reviewer is better than several reviewers with unnecessary code-mutation capability.

Issue #40 remains open as research for a future additional reviewer that satisfies all four properties:

> free + useful + review-only + least privilege

## Finding classification for future candidates

Any future candidate begins on probation. Classify substantive findings as:

1. **Confirmed defect**: evidence shows the finding is real and within intended behavior; fix it.
2. **Valid but optional**: technically reasonable but outside the requested scope; normally do not change the PR for it.
3. **Intentional behavior**: reviewer misunderstood a deliberate semantic or product choice; reject it.
4. **False positive**: the factual claim does not hold after inspection; reject it.
5. **Ambiguous or behavior-changing**: implementing it could alter intended functionality and intent is not resolved by issue/spec/code/tests/docs; escalate to the owner.

Two or more reviewers independently flagging the same concern increases investigation priority but does not change the classification rules.

## Documentation model

`docs/ai-code-review.md` is the canonical long-lived policy.

`CONTRIBUTING.md` contains concise contributor-facing expectations.

`AGENTS.md` contains the agent-facing evidence-not-authority and no-auto-fix rules.

This design file preserves rationale, rejected alternatives, live findings, and the final decision. The accompanying plans preserve the exact execution and rollback path.

No ADR is required. Reviewer integrations are deliberately easy to add/remove, and the decision does not meet the repository's bar for a hard-to-reverse architectural record.

## Current validation requirements

Before PR #41 is considered complete:

- repository docs consistently describe CodeRabbit as the only accepted active reviewer;
- Qodo, Sourcery, and Graphite appear only as evaluation history/rejected candidates rather than active setup instructions;
- no new AI API key or secret exists;
- no new AI-review GitHub Actions workflow exists;
- `.coderabbit.yaml` remains unchanged;
- no application, database, deployment, package, lockfile, or runtime behavior changes merely for this policy work;
- issue #40 is repurposed to future least-privilege reviewer research;
- Sourcery and Graphite are uninstalled from the repository by the maintainer;
- current-head CI and repository-required documentation validation are green before merge.
