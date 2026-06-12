# Documentation refresh plan

## Context
- The repo currently mixes **upstream Karakeep documentation** with **fork-specific notes**.
- Root docs already show this split clearly in `README.md`: the file starts with a short personal-fork disclaimer, then says “Everything below is upstream Karakeep's README.”
- `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md` currently duplicate the same project overview / fork / dev / deploy guidance.
- `docs/README.md` still contains the default Docusaurus boilerplate, which is stale for this repo.
- Key docs-site pages like `docs/docs/01-getting-started/01-intro.md`, `docs/docs/08-development/01-setup.md`, and `docs/docs/06-administration/05-troubleshooting.md` are still upstream-framed and not obviously aligned to this fork’s actual workflow.
- The repo has a substantial markdown surface beyond the root files: `docs/docs/**`, app/package `README.md`s, `DESIGN.md`, `PRODUCT.md`, `SECURITY.md`, and fork/deploy docs.
- User decisions for this pass:
  - public docs should stay **upstream-first with a fork overlay**
  - internal AI/assistant docs should be updated **together and broadly aligned** (`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, and similar root instruction docs if needed)
  - scope is **repo-wide**: root docs, internal docs, docs-site pages, docs tooling/readmes, and broader markdown sweep
  - rewrite style should be **strong**, so the resulting docs feel intentionally curated for this fork rather than lightly patched upstream text

## Approach
- Start with a **top-level docs audit** and define one documentation model for the repo.
- Use 3 documentation buckets:
  1. **Public / repo-facing docs** — `README.md`, `CONTRIBUTING.md`, `docs/README.md`, selected docs-site pages.
  2. **Agent / assistant docs** — `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, and any similar root-level instruction docs that should not drift.
  3. **Fork / operator docs** — `docs/fork-setup.md`, deploy docs, setup docs, and troubleshooting docs that must reflect the real local/dev/prod workflow of this fork.
- Public docs should remain explicit that this repo is a fork of upstream Karakeep, but the writing should be rewritten strongly enough that readers are not bounced between “real upstream docs” and “small fork notes”.
- Prefer **one source of truth** for project/fork/dev/deploy/tooling facts, then align derivative docs around it instead of keeping parallel hand-maintained summaries.
- Execute this in phases:
  - **Phase 1:** root docs + internal docs + docs tooling readmes
  - **Phase 2:** key docs-site pages (intro, setup, development, troubleshooting, fork/deploy)
  - **Phase 3:** broader markdown sweep across app/package READMEs and repo design/product docs for stale wording and broken assumptions

## Files to modify
- Highest priority root/public docs:
  - `README.md`
  - `CONTRIBUTING.md`
  - `docs/README.md`
- Highest priority internal/assistant docs:
  - `AGENTS.md`
  - `CLAUDE.md`
  - `GEMINI.md`
- Highest priority fork/operator docs:
  - `docs/fork-setup.md`
- Highest priority docs-site pages:
  - `docs/docs/01-getting-started/01-intro.md`
  - `docs/docs/08-development/01-setup.md`
  - `docs/docs/08-development/02-directories.md`
  - `docs/docs/06-administration/05-troubleshooting.md`
  - any docs pages that mention hosting, setup, contribution flow, naming/history, or fork-specific operations
- Broader markdown sweep targets:
  - `apps/landing/README.md`
  - `apps/mcp/README.md`
  - `apps/web/README.md`
  - `packages/sdk/README.md`
  - `packages/benchmarks/README.md`
  - `tools/compare-models/README.md`
  - `charts/README.md`
  - `kubernetes/README.md`
  - `DESIGN.md`
  - `PRODUCT.md`
  - `SECURITY.md`
  - other package/app-specific `README.md` files if they contradict the refreshed root docs

## Reuse
- Existing fork-specific factual source:
  - `docs/fork-setup.md`
- Existing project/fork/dev/deploy summary already reused in multiple places:
  - `AGENTS.md`
  - `CLAUDE.md`
  - `GEMINI.md`
- Existing public-facing structure to preserve or refine:
  - `README.md` sections for features, docs, demo, stack, alternatives, support
- Existing docs-site structure to fit into:
  - `docs/docs/**`
  - `docs/README.md`
- Existing contribution/setup framing to reconcile rather than duplicate:
  - `CONTRIBUTING.md`
  - `docs/docs/08-development/01-setup.md`

## Steps
- [ ] Audit root-level documentation and classify each file as public, internal-agent, or operator/fork docs.
- [ ] Identify duplicated facts (dev setup, deploy flow, fork relationship, tooling, CI/deploy behavior, supported commands) and define the canonical source for each.
- [ ] Refresh `README.md` with an upstream-first but fork-native structure: clearly explain this fork, remove the awkward “everything below is upstream README” split, and rewrite the repo-facing narrative so it reads as one coherent document.
- [ ] Refresh `CONTRIBUTING.md` so contribution expectations match the real repo and clearly distinguish upstream/community contribution norms from fork-specific maintenance if both need to remain visible.
- [ ] Refresh `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md` together so they stay aligned, concise, and sourced from the same fork/dev/deploy facts.
- [ ] Replace stale Docusaurus boilerplate in `docs/README.md` with repo-specific docs-site instructions.
- [ ] Review and rewrite the key docs-site pages (`intro`, `setup`, `directories`, `troubleshooting`, and related fork/deploy pages) so they reflect this fork’s actual development and operational workflow.
- [ ] Sweep app/package `README.md`s plus `DESIGN.md`, `PRODUCT.md`, and similar repo markdown files for stale upstream wording, contradictory instructions, and broken references.
- [ ] Run a final repo-wide docs consistency pass for naming, links, commands, fork terminology, and deployment/operator guidance.

## Verification
- Check all edited markdown for broken internal links and contradictory setup/deploy instructions.
- Verify that root docs, agent docs, docs-site pages, and package/app READMEs all agree on:
  - repo identity / fork relationship
  - local dev workflow
  - deploy workflow
  - code quality / test commands
  - contribution expectations
- Manually spot-check rendered markdown structure for:
  - `README.md`
  - `CONTRIBUTING.md`
  - `AGENTS.md`
  - `CLAUDE.md`
  - `GEMINI.md`
  - `docs/README.md`
  - docs-site pages that get updated
- Spot-check that links from root docs into `docs/` still resolve after rewrites.

## Decisions captured
- Public documentation remains **upstream-first with a fork overlay**.
- Internal assistant/instruction docs should be updated **together and broadly aligned**.
- Scope is **repo-wide**, including root docs, internal docs, docs-site pages, and broader markdown files.
- Rewrite style should be **strong**, so the result feels intentionally maintained for this fork rather than lightly patched upstream text.
