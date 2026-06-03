# UI Haul: COSS UI + Direction-A monochrome + Nunito

**Date:** 2026-06-03
**Status:** Approved design — ready for implementation planning
**Scope:** `apps/web` only (the landing site, browser extension, and mobile app are untouched)

## Context

The Karakeep web dashboard feels "bland, no life, no vibe, and the color is off in both light and dark mode." Investigation found the root cause: `tooling/tailwind/globals.css` is still the **raw shadcn "slate" starter** — the polished navy identity in `DESIGN.md` was aspirational and never made it into the tokens. Two concrete failures:

- **Light mode:** `--card` and `--background` are both pure white, so cards have nothing to separate from — flat white-on-white.
- **Dark mode:** `--card` and `--background` are the *identical* near-black navy, so cards have zero separation from the page — one dead slab.

The owner wants a near-complete visual upgrade that keeps the **layout identical**, and has chosen to adopt **COSS UI** (Base UI + Tailwind v4) as the new design system, with **Nunito** as the single typeface and **Google Sans Code** for mono. Target aesthetic is **"Direction A": refined monochrome** — navy + cool-neutral chrome with proper surface layering, no new accent hue, so saved content stays the only real color (the existing "content is color" principle).

The fork is **not in production** (the live `keep.abhipraya.dev` runs upstream; this fork's staging is separate) and **will not be pushed during this work** — so there is no deploy risk and no production constraint. Verification is local only.

## Locked decisions

| Decision | Choice |
|---|---|
| Visual direction | **A — refined monochrome** (navy + cool neutral, surface layering, no new hue) |
| Design system | **COSS UI** (Base UI + Tailwind v4), full adoption — replaces shadcn/Radix |
| Sans font (everywhere) | **Nunito** (weights 400/500/600/700/800; hierarchy by weight + size + color) |
| Mono font | **Google Sans Code** |
| Layout | **Unchanged** — this is a reskin + component-library swap, not a re-layout |
| Themes | Full light/dark parity, WCAG AA |
| Polish order | **Home → Search → Folders/Lists first.** Tags, highlights, archive, settings later |
| Deploy | **No push** during this work |

## What "full COSS" actually requires

COSS is Tailwind v4 + Base UI; Karakeep `apps/web` is Tailwind v3.4 + Radix (20 Radix packages, 47 `components/ui/*` primitives, Sonner for toasts). Adoption is app-wide in three parts:

1. **Tailwind v3 → v4 migration of `apps/web`.** New CSS-first config (`@import "tailwindcss"`, `@theme`, `@custom-variant dark`, `@tailwindcss/postcss`), oklch tokens, renamed utilities (e.g. `shadow-sm`→`shadow-xs`, `outline-none`→`outline-hidden`, ring defaults). This **cannot be scoped to three pages** — once the app is on v4, every styled file moves with it.
2. **47 Radix/shadcn primitives → coss/Base UI**, with consumer rewrites for API differences (`asChild`→`render`, menu `onSelect`→`onClick`, Select items-first, Slider scalar, ToggleGroup/Accordion array values, OTP field). Primitives are shared files, so this is per-component, not per-page — and it reskins every screen at once (tags/highlights/archive get the new look "for free," just without bespoke polish yet).
3. **Sonner → coss `toastManager`** across all toast call sites.

### Blast-radius containment

`apps/web/tailwind.config.ts` currently extends the shared `@karakeep/tailwind-config` preset, which **also feeds the landing site and browser extension** (both stay on v3). **Decouple `apps/web` from the shared preset** and give it its own Tailwind v4 setup, so the other apps are unaffected.

## Architecture

### Token system (Direction A)

Define coss semantic tokens in `apps/web`'s global stylesheet (`:root` + `.dark`). Values below are the design source of truth (sRGB hex); convert to oklch for the TW4 `@theme`/coss token blocks. Add a dedicated **sidebar** surface so header/sidebar/content/card read as distinct layers.

**Light**
| Token | Value | Role |
|---|---|---|
| `--background` | `#eef1f6` | app canvas (cool grey so cards pop) |
| `--card` / `--popover` | `#ffffff` | card/popover surface |
| `--foreground` | `#0f172a` | ink text |
| `--primary` | `#0f172a` | navy fill |
| `--primary-foreground` | `#f8fafc` | frost |
| `--secondary` / `--muted` | `#eef2f7` | secondary/muted surface |
| `--muted-foreground` | `#64748b` | metadata (≥4.5:1) |
| `--accent` | `#e7edf4` | hover/active tint |
| `--accent-foreground` | `#0f172a` | |
| `--border` / `--input` | `#e2e8f0` | hairlines |
| `--ring` | `#0f172a` | focus |
| `--destructive` | `#ef4444` | destructive only |
| sidebar surface | `#f6f8fb` | sidebar bg |

**Dark** (the key fix: card ≠ background)
| Token | Value | Role |
|---|---|---|
| `--background` | `#0b1120` | app canvas (deepest) |
| `--card` / `--popover` | `#16203a` | **elevated** surface — clearly above canvas |
| `--foreground` | `#e6edf6` | frost text |
| `--primary` | `#e8eef7` | inverted frost fill |
| `--primary-foreground` | `#0f172a` | ink |
| `--secondary` / `--muted` | `#1c2740` | secondary/muted surface |
| `--muted-foreground` | `#8b9bb4` | metadata (dark-legible) |
| `--accent` | `#233152` | hover/active tint |
| `--accent-foreground` | `#e6edf6` | |
| `--border` / `--input` | `#243149` | visible-but-subtle |
| `--ring` | `#cbd5e1` | focus |
| `--destructive` | `#ef4444` | destructive only |
| sidebar surface | `#0e1626` | sidebar bg |

Depth: cards get a soft resting shadow in light (`0 1px 2px rgba(2,8,23,.05), 0 1px 3px rgba(2,8,23,.08)`); dark relies on the card-vs-canvas tonal step plus a subtle border. The existing `shadow-lift` hover token carries over.

The tables above are the design-defining tokens. coss's full token contract also requires the paired `*-foreground` tokens (`--card-foreground`, `--popover-foreground`, `--secondary-foreground`, `--destructive-foreground`) and the status families (`--info`, `--success`, `--warning` and their foregrounds). Fill these from the coss styling docs, themed to Direction A: foregrounds follow the ink/frost convention above, and status families stay neutral-leaning (destructive is the only saturated break). Confirm the exact coss token names against `@coss/style` at install time rather than assuming the shadcn set 1:1.

### Fonts

Wire via `next/font` in `apps/web/app/layout.tsx`, matching coss's variable contract:

- **Nunito** → `--font-sans` **and** `--font-heading` (both Nunito; alias `--font-heading: var(--font-sans)`), weights 400/500/600/700/800, via `next/font/google`.
- **Google Sans Code** → `--font-mono`. Prefer `next/font/google`; if unavailable in the registry, fall back to `next/font/local` with the woff2.
- Remove the current Inter wiring. `font-synthesis` stays default (Nunito has real weights, so no faux-bold concern). Hierarchy = weight (800 page title → 700 card title → 400 body → 500 metadata) + size + color.

This supersedes the `DESIGN.md` "One Voice = Inter only" rule and the shadcn/monochrome-no-tokens reality. **`DESIGN.md` and `.impeccable/design.json` must be updated** to record the new system (Nunito + Google Sans Code, coss, Direction-A tokens) as part of this work.

### Component migration

Replace `apps/web/components/ui/*` (47 files) with coss equivalents via the shadcn CLI (`npx shadcn@latest add @coss/<component>`), then fix each consumer per the coss migration guide. High-risk primitives to verify against coss docs/particles: **dialog, dropdown-menu, select, form, input-group, toast, command, tabs, popover, tooltip**. Migrate Sonner usages to coss `toastManager` (note: `EditorCard` and `BookmarkActionBar` toasts were recently touched and will move too).

## Phasing

- **Phase 0 — Foundation (app-wide, unavoidable):** decouple `apps/web` from the shared Tailwind preset; migrate to Tailwind v4; install coss base; wire Direction-A tokens (light+dark) and Nunito/Google Sans Code; get the app type-checking, linting, and building on the new stack. *(No primitive swaps yet — existing components brought forward to compile under v4.)*
- **Phase 1 — Primitives:** migrate the 47 `components/ui/*` to coss/Base UI in batches (start with the most-used: button, input, card, dialog, dropdown-menu, select, tabs, tooltip, badge, separator, scroll-area, popover), rewrite consumers, migrate Sonner → toast. End state: app fully on coss.
- **Phase 2 — Home (bookmarks) polish:** apply Direction-A layering, spacing, and Nunito hierarchy to the home surface.
- **Phase 3 — Search polish.**
- **Phase 4 — Folders/Lists polish.**
- **Later (out of scope now):** tags, highlights, archive, settings, and any non-target surfaces get bespoke polish in a follow-up. They will already inherit the new tokens/fonts/primitives from Phases 0–1.

## Constraints & non-goals

- Layout and behavior stay the same; this is visual + library, not structural.
- Light/dark parity and WCAG AA throughout (muted text held to ≥4.5:1).
- No new accent hue (Direction A is monochrome).
- Do **not** touch the landing site, browser extension, or mobile app.
- Do **not** push (no Watchtower deploy).

## Risks

- **TW4 migration breadth** — touches every styled file in `apps/web`; the shared-preset decoupling must not regress landing/extension.
- **Base UI API differences** — 1:1 shadcn→coss assumptions will break; verify each primitive against coss docs + a particle example.
- **Verification is local + auth-gated** — most checks are typecheck/lint/format/build + manual dev-server walking; there's no production telemetry and the dashboard requires login.
- **Large Phase 1** — primitives are shared, so the swap is necessarily app-wide before per-page polish; expect a sizeable, well-batched changeset.

## Verification

- Per phase: `pnpm -F @karakeep/web typecheck`, `pnpm -F @karakeep/web lint`, `pnpm -F @karakeep/web format:fix`, and a successful `next build` (or dev boot).
- Pre-commit hook (`turbo run typecheck lint format`) gates every commit.
- Manual: `./start-dev.sh`, log in, walk Home/Search/Folders in **both** light and dark; confirm card separation (dark) and card lift (light), Nunito hierarchy, and that coss primitives behave (dialogs, selects, menus, toasts).
- No push at any point.

## Out of scope

Tags / highlights / archive / settings bespoke polish; any changes to landing, browser-extension, or mobile; backend/API changes; new features.
