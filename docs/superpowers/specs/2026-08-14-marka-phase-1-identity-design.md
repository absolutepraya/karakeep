# Marka Phase 1 Identity Design

**Status:** Approved for planning, pending implementation approval

## Purpose

Establish **Marka** as the approved public identity of this personal Karakeep fork, using the supplied deep-navy and white PNG artwork. Phase 1 updates the web application and repository presentation while preserving existing public domains and all Karakeep-compatible internal identifiers.

This design implements the Phase 1 portion of issues [#10](https://github.com/absolutepraya/karakeep/issues/10) and [#11](https://github.com/absolutepraya/karakeep/issues/11). The public landing site, fork-owned documentation hosting, and public naming cutover are planned separately in [#25](https://github.com/absolutepraya/karakeep/issues/25), [#26](https://github.com/absolutepraya/karakeep/issues/26), and [#27](https://github.com/absolutepraya/karakeep/issues/27).

## Confirmed decisions

- Product name: **Marka**.
- Brand palette: deep navy and white, aligned with the existing application theme.
- Source format: PNG only. No SVG tracing or conversion is required.
- Asset strategy: manually crop each supplied source for its intended use, with optical padding rather than a single square asset everywhere.
- Worktree: `.worktrees/marka-phase-1` on branch `absolutepraya/marka-phase-1`.

## Phase boundary

### Included in Phase 1

- Reusable Marka PNG source files, crop records, and derived web, landing, README, PWA, favicon, Apple touch icon, and social assets.
- User-visible Marka copy throughout the web application.
- Web metadata, manifest metadata, PWA labels, and accessible asset labels.
- Repository presentation and durable fork documentation: README, contributing guidance, assistant context, and operator documentation.
- A repository-wide audit that distinguishes intentional internal `karakeep` compatibility identifiers from stale user-visible branding.

### Excluded from Phase 1

- Browser extension, mobile app, and MCP product identity changes.
- DNS, domains, certificates, redirects, OAuth callbacks, CORS, webhooks, email configuration, analytics, and production deployment changes.
- GitHub repository rename, GitHub topics, GHCR image-path migration, package rename, extension identifiers, mobile bundle identifiers, or API namespace changes.
- Publishing a fork-owned landing site or documentation site.

The excluded work is not dropped. Issues #25, #26, and #27 own it, including its discovery, compatibility plan, live cutover, and rollback requirements.

## Asset architecture

The supplied 1254 by 1254 PNGs in Downloads are the canonical artwork. Phase 1 will copy the selected originals into a tracked Marka source directory and leave the Downloads files untouched. A checked-in asset manifest will name each original, its chosen crop, its target dimensions, and its consumers.

| Source treatment | Intended use |
| --- | --- |
| Navy standalone mark | Light UI, light browser chrome, small mark derivatives |
| White standalone mark | Dark UI and dark browser chrome |
| Navy horizontal wordmark | README, light landing and documentation contexts |
| White horizontal wordmark | Dark landing, documentation, and social contexts |
| Navy rounded-square mark | Standard installed-app and PWA icons |
| White rounded-square mark | Inverse installed-app and social contexts |

Derived assets must be tightly cropped with deliberate safety padding. Small icons must be inspected at actual 16, 48, 128, 192, and 512 pixel sizes. The app-icon variants retain their intended rounded-square containers rather than trying to make a transparent mark from a white-background source.

The implementation will use one logical Marka asset family, then place output files only in the established static-asset locations for the web app, landing app, docs site, and repository previews. Existing SVG consumers will be changed to PNG consumers where Phase 1 applies.

## Product and metadata behavior

All user-visible web-app branding becomes Marka. This includes authentication screens, navigation, onboarding, settings, dialogs, empty states, notifications, page titles, app name, PWA manifest labels, screenshots labels, and accessible image labels.

Internal compatibility names remain unchanged. This includes package scopes, API namespaces, database and asset paths, protocol keys, environment-variable names, and deployed service identifiers. A search hit is not by itself a rename candidate: each hit must be categorized as user-visible branding, upstream attribution, or an intentional compatibility identifier.

The web application metadata will use Marka title and application-name values, and will point browser, Apple touch, and manifest icon declarations at the new PNG family. Social previews and README visuals will use the horizontal wordmark composition and an approved Marka presentation.

## Documentation and repository presentation

The documentation ownership model is:

| Audience | Canonical Phase 1 source |
| --- | --- |
| Public fork overview and repository presentation | `README.md` |
| Contributions | `CONTRIBUTING.md` |
| Local development and fork operation | `docs/fork-setup.md` |
| Docs-site development | `docs/README.md` |
| Assistant operating context | `AGENTS.md`, `CLAUDE.md`, and `GEMINI.md` |

README copy, headings, logo, preview image, alt text, and visible metadata will present Marka as this fork's identity. Karakeep remains explicitly credited as the upstream project. Existing upstream sites and URLs stay visible only when they are accurate upstream references. Phase 1 must not imply that `karakeep.app` or `docs.karakeep.app` is Marka-operated.

Fork-owned landing publishing belongs to #25. Fork-owned documentation hosting at `docs.keep.abhipraya.dev` belongs to #26. Phase 1 may make local documentation coherent, but does not change live domain configuration, canonical URLs, hosted docs-site metadata, or deployment behavior before those issues have approved cutover plans.

## Error handling and safety

- Do not modify or delete the original Downloaded PNGs.
- Do not infer a production hostname or rename an external service.
- Stop if an asset source does not support a clean crop at its target size. Report the failed target and use no substitute artwork without approval.
- Keep current URLs, GitHub repository identity, GHCR paths, deployment configuration, and production data untouched.
- Preserve upstream attribution and never replace it with an unverified Marka service claim.

## Verification

1. Verify every checked-in PNG's format, dimensions, and expected use against the asset manifest.
2. Inspect representative small and large assets, including favicon, PWA, light, dark, horizontal, and square contexts.
3. Search the Phase 1 scope for `Karakeep` and categorize every remaining visible hit as intentional upstream attribution or an implementation miss.
4. Validate metadata and manifest output, including title, application name, icon URLs, screenshots labels, and accessible image text.
5. Run scoped formatting, lint, type, web build, landing build, and documentation checks appropriate to modified files.
6. Inspect the rendered web UI and README locally at desktop and mobile widths.
7. Confirm no domain, deployment, identifier, or production-state mutation was made.

## Implementation sequence

1. Inventory the exact web, landing, docs, and repository asset consumers.
2. Add the selected Marka source PNGs and manifest, then generate and inspect derivatives.
3. Update web application branding, metadata, manifest, and static icons.
4. Update repository presentation and Phase 1 documentation ownership and wording.
5. Update applicable local landing and docs source assets without publishing or changing domains.
6. Run the verification sequence and summarize deferred work under #25, #26, and #27.

