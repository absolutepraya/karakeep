# AI Reviewer Army Design

## Goal

Expand the repository's existing CodeRabbit review setup with Qodo, Sourcery, and Graphite Agent so pull requests can receive several independent AI review signals without allowing any AI reviewer to modify the codebase autonomously or become an authoritative merge gate.

This design implements issue #40 and records the decisions made during the review-tool design interview so future maintainers and coding agents do not need the original conversation to reconstruct intent.

The operating principle is:

> Four independent critics, zero autonomous fixers.

## Problem statement

CodeRabbit is already enabled and trusted as the repository's broad, repository-aware AI reviewer. A single reviewer still creates a single point of failure for false positives, missed edge cases, and model-specific assumptions. Adding several independent reviewers can improve coverage, especially for logic bugs, ticket/spec compliance, tests, maintainability, performance, security, regressions, and edge cases.

The main risk is not merely duplicate comments. The larger risk is "slop review": an AI reviewer can confidently recommend a change that is technically plausible but conflicts with the intended product flow, authorization model, data semantics, API contract, deployment model, or other intentional behavior. That risk becomes worse if a coding agent treats review comments as instructions rather than claims to verify.

The design therefore favors broader review coverage while keeping review authority deliberately weak.

## Reviewer set and roles

The intended reviewer set is:

| Reviewer | Intended role |
| --- | --- |
| CodeRabbit | Broad repository-aware semantic review and existing baseline |
| Qodo | Implementation correctness, issue/spec fulfillment, tests, authorization/security, and actionable defects |
| Sourcery | Maintainability, design, code quality, performance, security, and issue fulfillment |
| Graphite Agent | Logic bugs, edge cases, regressions, performance, and security using its free-tier defaults |

These are specialization goals, not exclusive ownership boundaries. Reviewers may overlap. Independent agreement increases investigation priority but never converts a claim into truth automatically.

## Authority model

AI review comments are evidence of a possible problem, not requirements and not instructions to change the implementation.

For every substantive finding, the implementing human or coding agent should verify the claim against the strongest available sources of truth:

1. the originating GitHub issue, approved spec, or explicit maintainer decision;
2. surrounding code and established existing behavior;
3. tests that encode externally observable behavior or invariants;
4. repository documentation and agent instructions;
5. actual runtime, API, data-flow, authorization, and deployment semantics where relevant.

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

When intent remains ambiguous after inspection, escalate to the repository owner instead of "fixing" the code to satisfy the reviewer.

## Hard review-only safety rule

All four reviewers are critics only.

The rollout must not add or enable:

- automatic commits;
- automatic pushes;
- automatic application of code suggestions;
- autonomous coding/fixing agents acting on reviewer findings;
- workflows that turn review comments into patches automatically;
- automatic approvals used as merge authority;
- reviewer-driven branch mutations.

Inline review comments and GitHub suggestion blocks are acceptable because applying them remains a deliberate human/agent action. One-click suggestion UI does not change the rule: nothing is applied automatically.

For Qodo, automatic improve/code-suggestion tooling must not be part of the configured automatic command set. Only the review command should be configured automatically.

For Sourcery, use the pull-request review product only. Do not add the CLI `--fix` flow, production-issue auto-fix flow, or agent-based code mutation to this repository.

For Graphite, enable AI Reviews only. Graphite's separate coding-agent functionality is outside this rollout.

## Pull request scope

The desired baseline behavior is:

- automatically review non-draft pull requests targeting `main`;
- drafts are skipped until they become ready for review;
- coding-agent-authored implementation PRs are normal PRs and should receive AI review;
- pure dependency-bot PRs should not consume all four reviewers;
- deterministic GitHub Actions remain independent and authoritative for machine-checkable validation.

CodeRabbit already follows the non-draft `main` behavior.

Sourcery's current default behavior is compatible with the design: it skips draft PRs and dependency-bot PRs by default. Its post-push re-reviews are lighter than the initial review and capped rather than full fresh reviews on every commit.

Qodo should be configured so only its review command runs automatically. Do not configure automatic describe/improve decoration. Full manual re-review can be requested after meaningful changes when useful rather than deliberately running a full review for every tiny push.

Graphite Agent should use the native free-tier automatic review behavior available for the selected repository.

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

Low-value categories should be minimized when vendor controls make that possible:

- formatting already handled by the repo formatter;
- naming/style preferences already covered by linting or established conventions;
- generic "best practice" suggestions without demonstrated impact;
- comments on generated artifacts whose sources are reviewed elsewhere;
- extra PR summaries/decoration that duplicate an existing reviewer without adding review signal.

The existing CodeRabbit generated-artifact exclusions remain the reference set:

- `packages/open-api/karakeep-openapi-spec.json`
- `packages/sdk/src/karakeep-api.d.ts`
- `packages/db/drizzle/meta/**`

Apply equivalent exclusions to other reviewers only where the currently available plan and supported controls make that safe and unambiguous. Do not introduce unrelated repository-wide generated-file behavior merely to satisfy a reviewer.

## Qodo design

Use Qodo's hosted GitHub integration and repository-root `.pr_agent.toml` configuration.

The repository configuration should stay deliberately minimal to avoid pinning unnecessary vendor defaults. The automatic command list should contain only the current agentic review command. It must not contain automatic describe or improve commands.

Inline findings should use severity threshold `2`, meaning `remediation_recommended` and more severe findings can be published inline while informational-only findings are suppressed from inline noise.

Qodo should receive concise review guidance emphasizing:

- verify correctness against the linked issue/spec and surrounding code;
- prioritize auth/authorization, data-loss, security, lifecycle, regression, and test gaps;
- do not recommend functionality or product-semantics changes merely as generic improvements;
- treat existing intended behavior as a constraint unless the linked issue/spec explicitly changes it;
- prefer substantive defects over formatting/style advice.

Qodo automatically recognizes GitHub issue references in PR descriptions, so implementation PRs should keep explicit issue links such as `Closes #40`.

Repository-root Qodo configuration only takes effect from the default branch for pull requests created after the configuration is merged. Therefore the implementation PR can prove that the GitHub App itself works, but the next real PR after merge is the definitive validation of the merged `.pr_agent.toml` policy.

Do not use a repository wiki configuration for bootstrap. Keeping policy source-controlled is preferred even though it means post-merge validation is required.

## Sourcery design

Use Sourcery's hosted GitHub integration for automatic PR reviews on this public open-source repository.

Sourcery currently supports repository-specific Review Settings and Review Rules in its web dashboard. No new Sourcery CLI, pre-commit hook, GitHub Actions workflow, or token should be added.

For this repository, configure Sourcery to focus on inline AI review comments. Disable redundant summary/reviewer-guide/tips output where the current dashboard allows it, because CodeRabbit already provides broad PR summaries and the objective here is independent defect signal rather than four copies of PR decoration.

Keep draft reviews disabled. Keep the default dependency-bot skip behavior. Restrict the repository to `main` as the relevant base branch where the dashboard supports that filter.

Add a small number of review rules, not a large duplicated ruleset. Focus those rules on maintainability/design/performance and preservation of intended behavior rather than copying the full CodeRabbit path instruction set.

Sourcery uses GitHub issues as review context and can assess whether linked issue requirements appear implemented. Preserve that behavior.

During calibration, use thumbs-up/thumbs-down reactions consistently. Sourcery uses those reactions as organization-scoped learning signals, so useful comments should be reinforced and incorrect/noisy comments should be marked unhelpful.

Sourcery automatically performs lightweight re-reviews after pushes and caps them. Accept that native behavior; do not add a separate automation for re-review. A manual full review can be requested when needed after substantial changes.

## Graphite design

Use Graphite Agent AI Reviews through the Graphite GitHub App, scoped only to this personal repository.

The free Hobby plan supports personal repositories and limited AI reviews. Review customization, filters, and custom rules are not included on Hobby, so this rollout must not depend on Graphite-specific custom policy being available.

Graphite should therefore be treated as a bonus independent reviewer using vendor defaults. Its limited quota must never become a dependency for merging.

If the free quota becomes restrictive, the maintainer may later pursue Graphite's open-source access/sponsorship path. That is follow-up administration, not a blocker for this rollout.

Do not enable or depend on separate Graphite coding-agent functionality.

## CodeRabbit relationship

The existing `.coderabbit.yaml` remains intact and CodeRabbit remains the broad, trusted baseline reviewer.

This rollout does not replace or weaken CodeRabbit. It also does not make CodeRabbit authoritative over issue/spec intent. The same evidence-not-authority rule applies to CodeRabbit even though it has already earned more practical trust in this repository than the three new reviewers.

## Merge and CI policy

All AI reviewers remain advisory.

There must be:

- no required AI-review status check solely because it is an AI reviewer;
- no required minimum count of AI approvals;
- no policy that every AI thread must mechanically be resolved before merging;
- no reviewer quota that can block a pull request;
- no replacement of deterministic CI with AI judgment.

GitHub Actions remains authoritative for deterministic validation such as formatting, linting, typechecking, tests, generated-artifact checks, Knip, React Doctor, and other repository CI checks.

Serious AI findings should still be investigated. "Advisory" means a bot cannot become authority by itself, not that findings should be ignored.

## Finding classification during probation

Qodo, Sourcery, and Graphite are new to this repository and should be treated as probationary for roughly the next 10 to 20 real pull requests.

Classify substantive findings into one of these buckets:

1. **Confirmed defect**: evidence shows the finding is real and within intended behavior; fix it.
2. **Valid but optional**: technically reasonable but outside the requested scope; normally do not change the PR for it.
3. **Intentional behavior**: reviewer misunderstood a deliberate semantic or product choice; reject it and provide negative feedback where supported.
4. **False positive**: the factual claim does not hold after inspection; reject it and provide negative feedback where supported.
5. **Ambiguous or behavior-changing**: implementing it could alter intended functionality and intent is not resolved by issue/spec/code/tests/docs; escalate to the owner.

Two or more reviewers independently flagging the same concern increases priority for investigation but does not change the classification rules.

After roughly 10 to 20 real PRs, compare reviewers by unique actionable findings, false-positive rate, redundant noise, and operational friction. Retune or remove reviewers that add little value.

## Permission and installation policy

Use vendor-hosted GitHub Apps rather than new repository GitHub Actions workflows, API keys, or AI secrets.

Install each App for `absolutepraya/karakeep` only rather than granting account-wide access to unrelated repositories.

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

If a reviewer cannot satisfy the review-only safety model or acceptable permissions on its available free/open-source plan, skip that reviewer. Three safe reviewers are preferable to four reviewers obtained by weakening the policy.

## Documentation model

`docs/ai-code-review.md` is the canonical long-lived operator and contributor policy for the multi-reviewer setup.

`CONTRIBUTING.md` should contain a concise contributor-facing explanation and link to the canonical document.

`AGENTS.md` should contain a concise agent-facing rule stating that AI review findings are advisory evidence and must be verified before implementation, especially when they could alter intended behavior.

This design file preserves the rationale and trade-offs that produced the policy. The accompanying implementation plan records exact rollout steps.

No ADR is required. The reviewer set is deliberately easy to retune or remove, so the decision is not sufficiently hard to reverse to justify an architectural decision record.

## Rollout sequence

1. Add the source-controlled design, implementation plan, canonical review policy, Qodo configuration, and concise contributor/agent documentation.
2. Open the implementation PR against `main` and link issue #40.
3. Before installing each GitHub App, inspect its actual requested permissions against the permission ceiling above.
4. Install Qodo, Sourcery, and Graphite for this repository only when their permissions are acceptable.
5. Use the implementation PR as the first live integration smoke test for all three services, recognizing that branch-local Qodo config is not yet the effective default-branch config.
6. Fix repository-side integration mistakes in the same PR if live review exposes them.
7. Do not merge automatically. Leave the PR for explicit maintainer approval.
8. After merge, use the next real PR to verify the merged Qodo configuration and begin the 10 to 20 PR probation period.

## Validation requirements

Repository-side validation:

- the branch contains no new AI API key or secret;
- no new AI-review GitHub Actions workflow is added;
- existing CodeRabbit configuration is preserved;
- `.pr_agent.toml` configures automatic Qodo review only and does not configure automatic improve/describe behavior;
- the Qodo inline severity threshold is `2`;
- documentation consistently states review-only, advisory behavior;
- documentation makes the issue/spec and intended behavior authoritative over reviewer suggestions;
- no reviewer is documented as a required merge gate;
- the implementation diff does not alter application, database, deployment, or runtime behavior.

Live integration validation:

- Qodo can review the implementation PR after its App is installed;
- Sourcery can review the implementation PR after its App is installed;
- Graphite Agent can review the implementation PR under the selected free tier;
- CodeRabbit continues operating normally;
- all Apps are scoped only to this repository;
- no App required a permission that violates the approved ceiling;
- no service automatically commits, pushes, or applies code changes;
- review output is inspected for obvious duplicate/noisy behavior.

Post-merge validation:

- a newly created real PR confirms the merged Qodo `.pr_agent.toml` is in effect;
- the probation/evaluation process is followed for 10 to 20 real PRs.

## Out of scope

- replacing CodeRabbit;
- using PR-Agent self-hosted with paid LLM API inference;
- enabling automatic AI fixes or coding agents;
- changing branch protection to require AI checks;
- adding AI-review GitHub Actions workflows;
- storing vendor API tokens or LLM secrets in GitHub;
- changing deterministic CI behavior;
- changing application functionality solely to satisfy reviewer opinions;
- Graphite paid-plan review customization;
- enabling Sourcery production-issue auto-fix or Qodo improve flows;
- automatically removing a reviewer before the planned calibration period unless it violates the safety/permission model.

## Current vendor references

These URLs were checked during design and should be re-verified if vendor behavior changes materially:

- Qodo configuration: <https://docs.qodo.ai/qodo-documentation/code-review/get-started/configuration-overview/configuration-file>
- Qodo GitHub issue context: <https://docs.qodo.ai/code-review/integrations/ticketing-integrations/github>
- Qodo ignore/content controls: <https://docs.qodo.ai/code-review/concepts/ignore-content-from-analysis>
- Sourcery code reviews: <https://docs.sourcery.ai/reviews/>
- Sourcery review settings: <https://docs.sourcery.ai/reviews/configure/>
- Sourcery review rules: <https://docs.sourcery.ai/reviews/review-rules/>
- Sourcery review anatomy/re-reviews: <https://docs.sourcery.ai/reviews/anatomy-of-a-review/>
- Graphite AI review setup: <https://graphite.com/docs/ai-reviews-setup>
- Graphite AI review customization: <https://graphite.com/docs/ai-review-customization>
- Graphite billing/plans: <https://graphite.com/docs/billing-plans>
