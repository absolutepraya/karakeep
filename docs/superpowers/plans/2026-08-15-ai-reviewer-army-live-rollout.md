# AI Reviewer Hosted Evaluation Record

This companion record captures the hosted-service portion of issue #40 and PR #41. It supersedes the original plan to keep Sourcery and Graphite enabled alongside CodeRabbit.

**Related issue:** #40

**Canonical policy:** `docs/ai-code-review.md`

**Design:** `docs/superpowers/specs/2026-08-15-ai-reviewer-army-design.md`

## Non-negotiable safety model

- Reviewers are critics only.
- No automatic commits, pushes, applied fixes, reviewer-driven coding agents, or branch mutation.
- AI comments are evidence to verify, never authority over issue/spec intent or established behavior.
- No AI reviewer is a required merge gate.
- Install a candidate only for `absolutepraya/karakeep`.
- Reject repository-content write, Actions/workflow write, administration, secrets/environments, or equivalent broad code-mutation privileges.
- Use only zero-cost access unless the maintainer explicitly makes a different decision later.

## Original candidate set

The experiment considered:

- CodeRabbit: existing trusted baseline;
- Qodo: correctness/spec/test-focused candidate;
- Sourcery: maintainability/design/performance/security candidate;
- Graphite Agent: logic/edge-case/regression candidate.

The final accepted state after evaluation is **CodeRabbit only**.

## Qodo evaluation

**Status: rejected before installation.**

Qodo's permanent zero-cost path required open-source qualification/application. That did not fit the desired low-friction "install and keep using the free plan" model.

No Qodo repository configuration remains in the final PR diff.

## Sourcery live evaluation

**Status: rejected after installation and smoke test.**

What worked:

- free open-source access was available;
- the GitHub App was connected to `absolutepraya/karakeep`;
- a manual `@sourcery-ai review` request successfully triggered a review on PR #41.

Why it was rejected:

GitHub reported the installed Sourcery App with permissions including:

- repository contents: write;
- Actions: write;
- workflows: write;
- checks/statuses/reviews/comments write permissions needed for integration behavior.

The first three capabilities exceed the approved least-privilege ceiling. The integration is therefore rejected even if Sourcery's PR-review mode is configured not to auto-fix.

### First-review calibration

Sourcery's first high-level review raised two points:

1. reduce duplication between the canonical policy, design spec, and plans;
2. rename the `2026-08-15-*` files because it claimed they were future-dated.

Classification:

- duplication comment: **valid but optional / intentional design trade-off**. The maintainer explicitly requested complete durable design and execution knowledge in the PR, and the repository already uses separate spec and plan files;
- date comment: **false positive**. The review ran on 2026-08-16, so `2026-08-15` was the previous day, not a future date.

No repository changes should be made merely to satisfy either finding.

## Graphite live evaluation

**Status: rejected on permission model.**

What worked:

- the free Hobby plan was available;
- Graphite was connected to `absolutepraya/karakeep` with AI Reviews enabled.

Why it was rejected:

Graphite's GitHub App permission model includes read/write access to repository contents and Actions/workflows as part of the broader Graphite pull-request product.

Those capabilities exceed the approved review-only ceiling. Graphite is therefore rejected even if AI Reviews themselves are configured as non-mutating.

A long-term quality probation is unnecessary after the permission failure.

## CodeRabbit regression check

CodeRabbit remains the accepted reviewer.

- Keep `.coderabbit.yaml` unchanged unless a real integration conflict is discovered.
- Keep CodeRabbit advisory rather than authoritative.
- Apply the same evidence-not-authority rule to CodeRabbit findings even though it has more practical trust in this repository.

## Branch protection / ruleset policy

No AI reviewer status should be a required merge check.

Reviewer downtime, quota exhaustion, or a negative AI status must never mechanically block merge eligibility.

If a future candidate automatically introduces or encourages a required AI status, remove that requirement before evaluating the integration further.

## Hosted cleanup required

The rejected integrations should not retain repository access.

Maintainer action required outside source control:

- uninstall or remove `absolutepraya/karakeep` access from Sourcery;
- uninstall or remove `absolutepraya/karakeep` access from Graphite.

After cleanup, verify:

- neither rejected App still has repository access;
- no Sourcery/Graphite status is required by branch protection or rulesets;
- CodeRabbit continues operating normally.

Do not mark hosted cleanup complete solely because repository docs changed.

## Evaluation result

The original three-reviewer live rollout is **not successful** under the approved safety model.

That is an expected valid outcome of the experiment. The design explicitly preferred a smaller safe reviewer set to weakening least-privilege requirements.

The resulting reviewer state is:

| Reviewer | State |
| --- | --- |
| CodeRabbit | Accepted / active |
| Qodo | Rejected: OSS qualification/application friction |
| Sourcery | Rejected: excessive GitHub App write permissions; first review also demonstrated noise/false-positive risk |
| Graphite Agent | Rejected: excessive GitHub App write permissions |

## Future research

Issue #40 remains open to find an additional reviewer satisfying:

> free + useful + review-only + least privilege

For future candidates:

1. verify current pricing first;
2. inspect exact GitHub App permissions before treating installation as accepted;
3. reject contents-write, Actions/workflows-write, admin, secrets/environment, or equivalent mutation capability;
4. scope installation to this repository only;
5. use a real PR as a smoke test;
6. inspect actual findings before trusting the reviewer;
7. record both permission and quality results in the repository.
