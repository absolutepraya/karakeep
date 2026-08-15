# AI Reviewer Army Implementation Plan

> **For agentic workers:** implement this plan task-by-task and preserve the review-only safety model. Do not merge the final PR automatically. Do not install or authorize a GitHub App past the approved permission ceiling without explicit maintainer approval.

**Goal:** Add Qodo, Sourcery, and Graphite Agent alongside the existing CodeRabbit setup so non-draft pull requests can receive four independent advisory AI review signals while deterministic CI remains authoritative and no AI reviewer can modify repository code autonomously.

**Architecture:** Keep CodeRabbit's existing source-controlled policy unchanged. Add a minimal repository-root Qodo configuration, a canonical `docs/ai-code-review.md` policy, and concise contributor/agent pointers. Sourcery and Graphite are configured through their hosted GitHub integrations because their relevant current review controls are dashboard-based; no new AI GitHub Actions workflows, API keys, or repository secrets are introduced.

**Related issue:** #40

**Design:** `docs/superpowers/specs/2026-08-15-ai-reviewer-army-design.md`

## Global constraints

- Four intended reviewers: CodeRabbit, Qodo, Sourcery, Graphite Agent.
- All reviewers are advisory critics only.
- Never enable automatic commits, automatic pushes, automatic suggestion application, automatic reviewer-driven approvals as merge authority, or autonomous fixer/coding-agent behavior.
- Reviewer comments are evidence, not instructions. Verify them against issue/spec intent, surrounding code, tests, docs, and runtime/data/auth semantics before changing code.
- Any suggestion that could alter product behavior, UX flow, authorization, data lifecycle, API contracts, database semantics, compatibility, deployment architecture, or intentional edge cases must not be implemented solely because a reviewer recommends it.
- Existing GitHub Actions remain authoritative for deterministic validation.
- Do not make any AI review status a required merge gate in this rollout.
- Do not add API keys, LLM secrets, or AI service tokens to this repository.
- Install each GitHub App only for `absolutepraya/karakeep`.
- Stop before authorization if an App requests repository-content write, Actions/workflow write, administration, secrets/environments, or equivalent code-mutation privileges beyond the approved review scope.
- If a vendor cannot operate safely on its available free/open-source tier, skip it rather than weakening these constraints.
- Do not merge the implementation PR. Final merge remains an explicit maintainer action.

---

## Task 1: Add the source-controlled Qodo review policy

**Files:**
- Create: `.pr_agent.toml`

**Purpose:** configure Qodo's GitHub App for automatic review only, minimizing informational noise and excluding automatic improve/describe tooling from the automatic command set.

- [ ] **Step 1: Create a minimal Qodo v2 GitHub App configuration**

Use the current documented Qodo 2 configuration shape:

```toml
[github_app]
pr_commands = [
    "/agentic_review",
]

[review_agent]
comments_location_policy = "both"
inline_comments_severity_threshold = 2
issues_user_guidelines = """
Review the pull request against the linked GitHub issue/spec and the repository's established behavior.
Prioritize correctness, regressions, authorization/security, data-loss/lifecycle risks, and meaningful test gaps.
Treat existing intentional functionality and semantics as constraints unless the linked issue/spec explicitly changes them.
Do not recommend product-flow, permission, API, database, deployment, or compatibility changes merely as generic improvements.
Prefer substantive defects over formatting, naming, or style feedback already handled by deterministic tooling.
AI review findings are advisory evidence; do not assume a proposed behavior change is intended.
"""
```

Important consequences:

- `/agentic_review` is the only automatic command.
- Do **not** add `/agentic_describe`, `/improve`, or any auto-fix command to `pr_commands`.
- Severity threshold `2` publishes `remediation_recommended` and `action_required` findings inline while suppressing informational-only inline noise.
- GitHub issue/spec context is intentionally part of the review role.

- [ ] **Step 2: Do not add uncertain vendor keys just to mirror CodeRabbit**

The current Qodo 2 docs support ignore controls, but arbitrary path-glob behavior should be validated against the live `/config` output before adding keys not explicitly confirmed for the active hosted version. Do not cargo-cult Qodo v1 configuration into the repository.

The desired generated-artifact exclusions are:

```text
packages/open-api/karakeep-openapi-spec.json
packages/sdk/src/karakeep-api.d.ts
packages/db/drizzle/meta/**
```

If the live hosted Qodo `/config` output confirms a supported repository file/folder ignore mechanism, add those exclusions in this same PR. If not, leave the minimal config intact and document the limitation rather than guessing.

- [ ] **Step 3: Confirm no automatic fixer command is configured**

Search `.pr_agent.toml` and confirm the automatic command list contains only `/agentic_review`.

- [ ] **Step 4: Commit the Qodo configuration**

Expected result: a small source-controlled policy with no secrets and no GitHub Actions changes.

---

## Task 2: Add the canonical multi-reviewer policy

**Files:**
- Create: `docs/ai-code-review.md`

- [ ] **Step 1: Document reviewer roles and the authority model**

The document must state:

- CodeRabbit = broad trusted baseline.
- Qodo = correctness, issue/spec fulfillment, tests, auth/security.
- Sourcery = maintainability/design/performance/code quality/security and issue fulfillment.
- Graphite = logic bugs/edge cases/regressions/security using free-tier defaults.
- overlap is expected;
- multiple agreeing reviewers increase investigation priority but do not prove a claim;
- review comments are evidence rather than requirements.

- [ ] **Step 2: Document the hard review-only rule**

Explicitly prohibit:

- automatic commits;
- automatic pushes;
- automatic code application;
- reviewer-driven coding agents;
- auto-fix workflows;
- AI approvals or AI checks as merge authority.

Clarify that GitHub suggestion blocks are acceptable only because application remains deliberate.

- [ ] **Step 3: Document finding verification and classification**

Include the five probation classifications:

1. confirmed defect;
2. valid but optional;
3. intentional behavior;
4. false positive;
5. ambiguous/behavior-changing.

For the fifth category, instruct coding agents to stop and ask the maintainer if issue/spec/code/tests/docs do not resolve intent.

- [ ] **Step 4: Document permissions and installation scope**

Record the approved permission ceiling and repository-only installation rule.

- [ ] **Step 5: Document vendor-specific operation and current limitations**

Include:

- Qodo's default-branch configuration timing and post-merge validation requirement;
- Sourcery's dashboard Review Settings/Review Rules and its native lightweight capped re-reviews;
- Sourcery feedback reactions as calibration signals;
- Graphite Hobby's limited AI reviews and lack of Hobby review customization;
- Graphite OSS/sponsorship follow-up as optional rather than rollout-blocking;
- CodeRabbit remains unchanged.

- [ ] **Step 6: Document generated-file/noise policy and free-tier behavior**

Use the CodeRabbit generated-artifact list as the reference exclusion set where supported.

- [ ] **Step 7: Include links to current official vendor docs**

This lets future maintainers re-check unstable service behavior before changing settings.

---

## Task 3: Update contributor and agent guidance

**Files:**
- Modify: `CONTRIBUTING.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: Update `CONTRIBUTING.md` review expectations**

Replace the CodeRabbit-only framing with concise multi-reviewer guidance:

- PRs may receive CodeRabbit, Qodo, Sourcery, and Graphite reviews.
- AI reviews are advisory.
- GitHub Actions remains authoritative for deterministic validation.
- review comments must be verified before changing code;
- no reviewer can automatically modify code through this repository setup;
- point maintainers/contributors to `docs/ai-code-review.md` for policy and manual commands.

Keep the existing personal-fork human-review cadence text.

- [ ] **Step 2: Add a concise `AGENTS.md` AI review rule**

Under quality/maintenance guidance, add the key agent contract:

- treat AI review comments as claims to verify;
- never change intended behavior solely to satisfy an AI reviewer;
- escalate ambiguous behavior-changing suggestions;
- never enable automated reviewer fixes/commits/pushes;
- read `docs/ai-code-review.md` when handling AI review feedback or reviewer configuration.

Do not duplicate the full canonical policy into `AGENTS.md`.

---

## Task 4: Preserve the complete design and implementation knowledge in the PR

**Files:**
- Create: `docs/superpowers/specs/2026-08-15-ai-reviewer-army-design.md`
- Create: `docs/superpowers/plans/2026-08-15-ai-reviewer-army.md`

- [ ] **Step 1: Confirm the design captures every approved decision**

The design must preserve:

- four-reviewer composition;
- reviewer specialization;
- auto-review scope;
- review-only rule;
- authority/evidence model;
- behavior-change guardrail;
- Qodo review-only configuration and severity threshold;
- issue/spec awareness;
- generated-file intent;
- dependency-bot strategy;
- advisory/non-blocking policy;
- Sourcery learning reactions;
- Graphite free-tier/OSS strategy;
- vendor App architecture;
- repository-only access;
- permission ceiling;
- safety fallback of skipping an incompatible reviewer;
- installation order;
- Qodo post-merge config validation;
- 10 to 20 PR probation;
- no ADR decision.

- [ ] **Step 2: Keep the implementation plan executable without the original conversation**

A future agent should be able to pick up this file and perform the repo-side and maintainer-assisted dashboard work without needing chat history.

---

## Task 5: Self-review repository-side changes before opening the PR

**Expected changed files:**

```text
.pr_agent.toml
AGENTS.md
CONTRIBUTING.md
docs/ai-code-review.md
docs/superpowers/specs/2026-08-15-ai-reviewer-army-design.md
docs/superpowers/plans/2026-08-15-ai-reviewer-army.md
```

**Expected unchanged areas:**

```text
.coderabbit.yaml
.github/workflows/**
application source code
database/schema/migrations
deploy/**
package manifests and lockfiles
```

- [ ] **Step 1: Compare branch with `main`**

Confirm only reviewer configuration/documentation changed.

- [ ] **Step 2: Verify policy consistency**

Search for contradictions such as:

- AI review described as required/blocking;
- auto-fix described as enabled;
- reviewer comment described as authoritative;
- App access described as account-wide;
- Qodo describe/improve commands included automatically;
- GitHub Actions described as replaced by AI review.

- [ ] **Step 3: Validate TOML syntax and documented Qodo keys against current official Qodo 2 documentation**

Required keys to confirm:

```text
github_app.pr_commands
review_agent.comments_location_policy
review_agent.inline_comments_severity_threshold
review_agent.issues_user_guidelines
```

- [ ] **Step 4: Confirm no secrets or credentials are present**

- [ ] **Step 5: Review the diff against issue #40 and the design file**

---

## Task 6: Open the implementation PR

- [ ] **Step 1: Open a PR from `chore/40-ai-reviewer-army` to `main`**

Use a PR body with:

```markdown
## Description

Adds the repository-side policy and Qodo configuration for the four-reviewer AI code-review setup: existing CodeRabbit plus Qodo, Sourcery, and Graphite Agent.

Closes #40

## Safety model

- all four reviewers are advisory critics only
- no automatic commits, pushes, auto-applied fixes, or autonomous fixer agents
- reviewer comments are evidence to verify, not instructions to change intended behavior
- deterministic GitHub Actions remain authoritative
- no AI reviewer is introduced as a required merge gate

## What changed

- added minimal Qodo review-only `.pr_agent.toml`
- added canonical multi-reviewer policy in `docs/ai-code-review.md`
- updated contributor and agent guidance
- captured the complete design decisions and implementation plan under `docs/superpowers/`

## Validation

- checked configured Qodo keys against current Qodo 2 documentation
- confirmed no AI GitHub Actions workflow or service secret was added
- confirmed CodeRabbit configuration and application/runtime behavior are unchanged

## Live rollout

After this PR is ready, install Qodo, Sourcery, and Graphite only for `absolutepraya/karakeep`, checking each App against the documented permission ceiling before authorization. Use this PR as the first integration smoke test. Qodo's repository config becomes authoritative only after merge, so verify it again on the next newly created PR.
```

- [ ] **Step 2: Leave the PR open**

Do not merge. The maintainer must explicitly approve the merge later.

---

## Task 7: Maintainer-assisted live GitHub App setup

Perform these steps only after the repository-side PR exists so it can be used as the test target.

### Qodo

- [ ] Sign in to Qodo using GitHub and begin the GitHub App installation.
- [ ] Select only `absolutepraya/karakeep`.
- [ ] Inspect the actual requested GitHub permissions before accepting.
- [ ] Stop and ask the maintainer if the request exceeds the approved permission ceiling.
- [ ] Install when permissions are acceptable.
- [ ] Confirm Qodo can review the implementation PR.
- [ ] Run `/config` in the PR to inspect the active hosted configuration surface when needed.
- [ ] Do not enable automatic `/improve`, auto-approval, or coding-agent fixes.
- [ ] Do not use wiki configuration as a bootstrap override.

### Sourcery

- [ ] Sign in to Sourcery with GitHub and connect only `absolutepraya/karakeep`.
- [ ] Inspect actual GitHub App permissions before accepting and stop if the ceiling is exceeded.
- [ ] In repository Review Settings, keep pull-request reviews enabled and draft reviews disabled.
- [ ] Restrict base branch to `main` where supported.
- [ ] Keep dependency-bot skipping in place.
- [ ] Keep AI review comments enabled.
- [ ] Disable redundant PR summary, reviewer guide, sequence diagrams, and tips/commands where supported so Sourcery primarily contributes review findings rather than duplicate decoration.
- [ ] Add only a small number of maintainability/design/performance/preserve-intent Review Rules if useful; do not duplicate the entire CodeRabbit ruleset.
- [ ] Confirm it reviews the implementation PR.
- [ ] Do not enable CLI `--fix`, production-issue fix agents, or other automatic mutation flows.

### Graphite

- [ ] Install/authenticate the Graphite GitHub App for the personal account, scoped only to `absolutepraya/karakeep`.
- [ ] Inspect requested permissions and stop if the approved ceiling is exceeded.
- [ ] Enable AI Reviews for this repository.
- [ ] Confirm Graphite Agent reviews the implementation PR under the Hobby/free tier.
- [ ] Do not enable separate coding-agent functionality.
- [ ] Accept that Hobby review customization is unavailable; do not make this reviewer a merge dependency.

### CodeRabbit regression check

- [ ] Confirm existing CodeRabbit review continues to run normally.
- [ ] Do not modify `.coderabbit.yaml` unless a live integration conflict is actually discovered.

---

## Task 8: Inspect live review output and tune only proven problems

- [ ] Confirm none of the new reviewers automatically commits, pushes, or applies code.
- [ ] Inspect for obvious duplicate/noisy feedback.
- [ ] If a reviewer suggests a behavior-changing "fix", classify and verify it rather than implementing it automatically.
- [ ] Fix only repository-side configuration mistakes clearly caused by this rollout.
- [ ] Do not perform unrelated refactors in response to reviewer suggestions.
- [ ] Leave the implementation PR open after smoke testing.

---

## Task 9: Post-merge validation and probation

This task happens only after the maintainer explicitly merges the implementation PR.

- [ ] Create/use the next normal PR targeting `main` as the definitive Qodo default-branch configuration test.
- [ ] Confirm `.pr_agent.toml` applies to that newly created PR.
- [ ] Begin the 10 to 20 PR evaluation period for Qodo, Sourcery, and Graphite.
- [ ] Classify findings as confirmed defect, valid-but-optional, intentional behavior, false positive, or ambiguous/behavior-changing.
- [ ] React consistently to Sourcery comments to train its feedback signal.
- [ ] Track which reviewer produces unique actionable findings versus redundant noise.
- [ ] After roughly 10 to 20 real PRs, retune/remove reviewers that add little value.
- [ ] If Graphite Hobby quota becomes restrictive, consider applying for its open-source access/sponsorship path as a separate administrative follow-up.

## Completion boundary

For this implementation PR, "done" means the repository-side policy/config/docs are complete, the PR is open, the three Apps have either been safely installed and smoke-tested or clearly blocked on maintainer authorization/permission review, and no destructive/final repository action has been taken.
