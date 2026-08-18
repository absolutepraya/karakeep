# ADR 0001: Marka public identity cutover boundary

- Status: Accepted for implementation planning
- Date: 2026-08-15
- Issues: #10, #11, #27, #35

## Context

The fork is publicly branded as **Marka**, but its external operational identity still uses Karakeep-era names in several places, including the GitHub repository, GHCR package path, production hostname, installer/repository URLs, and operator documentation.

A single all-at-once rename of every `karakeep` identifier would mix public branding changes with compatibility-sensitive machine identifiers such as package scopes, environment variables, persisted paths, Compose services, Docker networks, export/protocol identifiers, and other internal names. That would substantially increase migration risk without being required to establish Marka as the public identity.

The active production deployment is owned by this fork and is operated as a personal deployment, so the public GitHub/GHCR/domain cutover does not need to preserve a general third-party migration window.

## Decision

Issue #27 owns only the **public identity cutover**.

The approved public targets are:

- GitHub repository: `absolutepraya/marka`
- Canonical application origin: `https://marka.abhipraya.dev`
- GHCR web image: `ghcr.io/absolutepraya/marka:web-main`
- GHCR workers image: `ghcr.io/absolutepraya/marka:workers-main`

The GHCR migration is a hard switch. CI stops publishing new fork images to `ghcr.io/absolutepraya/karakeep`; historical images may remain but are not a supported compatibility path.

After the new Marka origin is verified, `keep.abhipraya.dev` becomes a permanent path- and query-preserving redirect to `marka.abhipraya.dev`.

The GitHub repository is renamed rather than replaced. The old `absolutepraya/karakeep` repository name must not be recreated, so GitHub's rename redirects remain available for historical links.

Repository-controlled current references, raw GitHub URLs, installer entry points, active badges/links, GHCR references, operator documentation, and Git remotes under our control move to the Marka identity. Git history and historical issue/PR/comment content are not rewritten solely to erase the old name.

Before any production mutation, a fresh production backup is copied to the local MacBook used by the implementation agent and verified readable. A short controlled maintenance window is acceptable.

The GitHub rename is intentionally forward-only, but production service recovery remains viable until the cutover stabilizes. Before any mutation, retain the verified local backup, old image references, deployed Compose/environment files, and nginx configuration. If Marka fails before the legacy redirect is enabled, restore the previous Compose image references, `NEXTAUTH_URL`, and old-host application server block from that evidence; do not proceed to the redirect checkpoint. Do not attempt to recreate the old GitHub repository name, because that would break GitHub's rename redirect.

Database/schema changes and persisted-data rewriting solely for branding are forbidden in #27.

## Deferred work

Machine-facing/internal identifiers remain unchanged during #27, including, where applicable:

- `KARAKEEP_*` environment variables
- `@karakeep/*` package scopes and package names
- persisted data/config/cache paths
- Compose service/project naming
- Docker network names such as `karakeep-renderer`
- export/protocol identifiers and compatibility keys
- other internal constants that do not form the active public identity
- the VPS deployment directory under the operator's home directory
- the MacBook checkout directory under `Documents/Projects`

The VPS and MacBook directory renames are explicitly deferred to #35. They are machine-facing paths that can affect Compose project discovery, local backup tooling, worktree configuration, shell history, and operator automation. They require their own path-by-path migration and validation rather than an incidental `mv` during #27.

Their audit and deliberate migration are tracked separately by #35.

Browser-extension store identity, mobile-store identity, npm/SDK package publishing identity, and MCP distribution identity are also excluded from the #27 publishing cutover. They are audited only for accidental dependency on the GitHub/domain/GHCR values changed by #27; any actual distribution rename is separate follow-up work.

## Consequences

### Positive

- Marka becomes coherent across the actively operated public web, repository, image, and documentation surfaces.
- The production image path and repository name match the public product name.
- The cutover remains small enough to reason about and validate as one controlled operation.
- Compatibility-sensitive internal identifiers are not churned merely for aesthetics.

### Negative

- The codebase will temporarily contain intentional internal `karakeep` names after the public cutover.
- Historical GHCR images remain under the old package path.
- A later #35 migration may still be substantial because it must treat internal identifiers as compatibility-sensitive rather than performing blind string replacement.

## Verification requirement

The implementation plan for #27 must prove, before completion, that:

1. `absolutepraya/marka` is the canonical repository and fresh Git operations use it.
2. CI publishes paired Marka `web-main` and `workers-main` images and no longer publishes new fork images under the old package path.
3. Production actually runs the Marka images and Watchtower follows the new tags.
4. `https://marka.abhipraya.dev` works directly, including auth and core application/background-worker behavior.
5. New public/share/RSS URLs use the Marka origin.
6. `keep.abhipraya.dev` redirects to the equivalent Marka path/query once the new origin is proven healthy.
7. Current repository/docs/public metadata no longer use obsolete active identities except where intentionally historical/upstream/internal.
8. The pre-cutover production backup exists on the implementation MacBook and was verified before production mutation.
