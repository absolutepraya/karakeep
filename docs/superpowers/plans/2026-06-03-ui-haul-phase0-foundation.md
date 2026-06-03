# UI Haul — Phase 0: Tailwind v4 + Direction-A tokens + fonts

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate `apps/web` from Tailwind v3 to v4, decoupled from the shared preset, and install the Direction-A refined-monochrome token system + Nunito/Google Sans Code fonts — so the app builds on the new stack and the existing (still-Radix) UI immediately renders the new colour identity in light and dark.

**Architecture:** `apps/web` gets its own CSS-first Tailwind v4 setup (`@import "tailwindcss"` + `@theme inline` in a new `app/globals.css`), stops importing the shared `@karakeep/tailwind-config` (which keeps feeding the landing site + extension on v3). Direction-A semantic tokens are defined for `:root`/`.dark`; existing shadcn/Radix components consume them unchanged. `tailwindcss-animate` is replaced by `tw-animate-css`; the JS-config `resolveConfig` reads are refactored to a plain breakpoints constant since v4 drops that API.

**Tech stack:** Next 16, React 19, Tailwind CSS v4 (`@tailwindcss/postcss`), `tw-animate-css`, `@tailwindcss/typography`, `next/font/google` (Nunito + Google Sans Code), oxlint/oxfmt, pnpm.

**Scope note:** This is **Phase 0 only.** Later phases get their own plans because their code depends on this one's output: Phase 1 (swap all 47 `components/ui/*` to coss/Base UI + Sonner→toast) can only be written concretely once the coss CLI has generated the component files against this v4 foundation; Phases 2–4 are per-surface visual polish (Home → Search → Folders). After Phase 0, the app is fully on v4 with Direction-A colour + Nunito, with the existing Radix components still in place — a coherent, testable milestone.

**Verification model:** This is a build-and-visual migration, not feature code — there are no unit tests for CSS tokens. "Verify" means `pnpm -F @karakeep/web typecheck`, `lint`, `build`, and a manual dev-server walk in **both** themes. Each task ends by verifying then committing. **Never push** (no deploy).

---

## File structure

| File | Action | Responsibility |
|---|---|---|
| `apps/web/package.json` | modify | swap TW3 deps → TW4 toolchain |
| `apps/web/postcss.config.js` | modify | use `@tailwindcss/postcss` |
| `apps/web/app/globals.css` | **create** | TW4 entry: tokens (light+dark), `@theme inline`, fonts, ported radius/shadow/animations/container/scrollbar/reduced-motion |
| `apps/web/lib/breakpoints.ts` | **create** | masonry breakpoint constants (replaces `resolveConfig`) |
| `apps/web/components/dashboard/bookmarks/BookmarksGrid.tsx` | modify | use breakpoints constant |
| `apps/web/components/dashboard/bookmarks/BookmarksGridSkeleton.tsx` | modify | use breakpoints constant |
| `apps/web/components/public/lists/PublicBookmarkGrid.tsx` | modify | use breakpoints constant |
| `apps/web/tailwind.config.ts` | **delete** | v4 is CSS-first |
| `apps/web/components.json` | modify | drop `tailwind.config` path (prep for coss CLI) |
| `apps/web/app/layout.tsx` | modify | Nunito + Google Sans Code via next/font; import local globals |
| `apps/web/components/shared/sidebar/SidebarLayout.tsx` | modify | main canvas `bg-muted` → `bg-background` |
| `DESIGN.md` | modify | record Nunito/Google Sans Code + Direction-A tokens (supersedes "Inter only") |

---

## Task 1: Install the Tailwind v4 toolchain

**Files:** `apps/web/package.json`, `apps/web/postcss.config.js`

- [ ] **Step 1: Swap dependencies**

Run (from repo root):

```bash
pnpm -F @karakeep/web remove tailwindcss autoprefixer @karakeep/tailwind-config
pnpm -F @karakeep/web add -D tailwindcss@^4 @tailwindcss/postcss@^4 tw-animate-css @tailwindcss/typography
```

Expected: `tailwindcss` resolves to `^4.x`, `@tailwindcss/postcss`, `tw-animate-css`, `@tailwindcss/typography` added to `devDependencies`; `autoprefixer` and `@karakeep/tailwind-config` removed.

- [ ] **Step 2: Point PostCSS at the v4 plugin**

Replace the entire contents of `apps/web/postcss.config.js` with:

```js
module.exports = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
```

(Tailwind v4 handles vendor prefixing itself, so `autoprefixer` is gone.)

- [ ] **Step 3: Install & sanity-check the dep tree**

Run:

```bash
pnpm install
pnpm -F @karakeep/web exec tailwindcss --help
```

Expected: install completes; the second command prints v4 CLI help (confirms tailwindcss@4 is resolvable). Do **not** build yet — `globals.css` doesn't exist.

- [ ] **Step 4: Commit**

```bash
git add apps/web/package.json apps/web/postcss.config.js pnpm-lock.yaml
git commit -m "build(web): switch to the Tailwind v4 toolchain"
```

---

## Task 2: Refactor masonry breakpoints off `resolveConfig`

Tailwind v4 removes `tailwindcss/resolveConfig` and the JS config object. Three files read `theme.screens` through it; replace with a constant of the Tailwind default breakpoints the app already relies on (`sm 640 / md 768 / lg 1024`).

**Files:**
- Create: `apps/web/lib/breakpoints.ts`
- Modify: `apps/web/components/dashboard/bookmarks/BookmarksGrid.tsx`, `apps/web/components/dashboard/bookmarks/BookmarksGridSkeleton.tsx`, `apps/web/components/public/lists/PublicBookmarkGrid.tsx`

- [ ] **Step 1: Create the constant**

Create `apps/web/lib/breakpoints.ts`:

```ts
// Tailwind's default screen breakpoints (px). Previously read at runtime via
// tailwindcss/resolveConfig, which Tailwind v4 removed. The masonry grid only
// needs sm/md/lg to decide column counts.
export const SCREENS = {
  sm: 640,
  md: 768,
  lg: 1024,
} as const;
```

- [ ] **Step 2: Update `BookmarksGrid.tsx`**

Remove these two imports (currently lines ~17 and ~22):

```ts
import tailwindConfig from "@/tailwind.config";
import resolveConfig from "tailwindcss/resolveConfig";
```

Add this import alongside the other `@/lib` imports:

```ts
import { SCREENS } from "@/lib/breakpoints";
```

In `getBreakpointConfig` replace:

```ts
  const fullConfig = resolveConfig(tailwindConfig);
  ...
  breakpointColumnsObj[parseInt(fullConfig.theme.screens.lg)] = lgColumns;
  breakpointColumnsObj[parseInt(fullConfig.theme.screens.md)] = mdColumns;
  breakpointColumnsObj[parseInt(fullConfig.theme.screens.sm)] = smColumns;
```

with:

```ts
  breakpointColumnsObj[SCREENS.lg] = lgColumns;
  breakpointColumnsObj[SCREENS.md] = mdColumns;
  breakpointColumnsObj[SCREENS.sm] = smColumns;
```

In `getColumnsForViewport` replace:

```ts
  const fullConfig = resolveConfig(tailwindConfig);
  const screens = fullConfig.theme.screens;
  const lg = parseInt(screens.lg);
  const md = parseInt(screens.md);
  const sm = parseInt(screens.sm);
```

with:

```ts
  const { sm, md, lg } = SCREENS;
```

(The rest of both functions already use `sm`/`md`/`lg` as numbers.)

- [ ] **Step 3: Update `BookmarksGridSkeleton.tsx`**

Remove (lines ~9, ~11):

```ts
import tailwindConfig from "@/tailwind.config";
import resolveConfig from "tailwindcss/resolveConfig";
```

Add:

```ts
import { SCREENS } from "@/lib/breakpoints";
```

Replace the `const fullConfig = resolveConfig(tailwindConfig);` usage (line ~14) and any `parseInt(fullConfig.theme.screens.X)` reads with the matching `SCREENS.X` numeric value, mirroring Step 2. Read the file first to map each `fullConfig.theme.screens.*` reference to its `SCREENS.*` equivalent; remove the now-unused `fullConfig` variable.

- [ ] **Step 4: Update `PublicBookmarkGrid.tsx`**

Same transform as Step 3 (imports at lines ~13/~18, usage at ~176). Replace `resolveConfig(tailwindConfig)` screen reads with `SCREENS`, remove the two imports, add `import { SCREENS } from "@/lib/breakpoints";`.

- [ ] **Step 5: Verify no `resolveConfig`/`@/tailwind.config` references remain**

Run:

```bash
cd apps/web && rg -n "resolveConfig|@/tailwind.config" -g '*.ts' -g '*.tsx' . ; cd ../..
```

Expected: **no output**.

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/breakpoints.ts apps/web/components/dashboard/bookmarks/BookmarksGrid.tsx apps/web/components/dashboard/bookmarks/BookmarksGridSkeleton.tsx apps/web/components/public/lists/PublicBookmarkGrid.tsx
git commit -m "refactor(web): read masonry breakpoints from a constant (Tailwind v4 drops resolveConfig)"
```

---

## Task 3: Create the Tailwind v4 `globals.css` with Direction-A tokens

This is the heart of Phase 0: the v4 entrypoint, the Direction-A token set (light + dark), the `@theme inline` mappings that drive every `bg-*`/`text-*`/`border-*` utility, the font-variable wiring, and the ported radius/shadow/animations/container/scrollbar/reduced-motion from the old shared preset.

**Files:** Create `apps/web/app/globals.css`

- [ ] **Step 1: Write the file**

Create `apps/web/app/globals.css` with exactly:

```css
@import "tailwindcss";
@import "tw-animate-css";

@plugin "@tailwindcss/typography";

/* Dark mode is driven by a `.dark` class on <html> (next-themes). */
@custom-variant dark (&:is(.dark *));

/* Extra class sources beyond apps/web (monorepo deps Tailwind won't auto-scan). */
@source "../../../packages/shared-react/components";
@source "../../../node_modules/streamdown/dist/*.js";
@source "../../../node_modules/@streamdown/cjk/dist/*.js";
@source "../../../node_modules/@streamdown/code/dist/*.js";
@source "../../../node_modules/@streamdown/math/dist/*.js";
@source "../../../node_modules/@streamdown/mermaid/dist/*.js";

/* ============================================================
   Direction A — refined monochrome (navy + cool neutral).
   LIGHT: cool-grey canvas so white cards pop.
   ============================================================ */
:root {
  --background: #eef1f6;
  --foreground: #0f172a;
  --card: #ffffff;
  --card-foreground: #0f172a;
  --popover: #ffffff;
  --popover-foreground: #0f172a;
  --primary: #0f172a;
  --primary-foreground: #f8fafc;
  --secondary: #eef2f7;
  --secondary-foreground: #0f172a;
  --muted: #eef2f7;
  --muted-foreground: #64748b;
  --accent: #e7edf4;
  --accent-foreground: #0f172a;
  --destructive: #ef4444;
  --destructive-foreground: #f8fafc;
  --border: #e2e8f0;
  --input: #e2e8f0;
  --ring: #0f172a;

  /* status families — Direction A keeps these neutral; destructive is the only saturated break */
  --info: #0f172a;
  --info-foreground: #f8fafc;
  --success: #0f172a;
  --success-foreground: #f8fafc;
  --warning: #0f172a;
  --warning-foreground: #f8fafc;

  /* dedicated sidebar surface (applied to the rail during Phase 2 polish) */
  --sidebar: #f6f8fb;
  --sidebar-foreground: #0f172a;
  --sidebar-primary: #0f172a;
  --sidebar-primary-foreground: #f8fafc;
  --sidebar-accent: #e7edf4;
  --sidebar-accent-foreground: #0f172a;
  --sidebar-border: #e2e8f0;
  --sidebar-ring: #0f172a;

  --radius: 0.5rem;
}

/* DARK: deepest canvas, cards visibly elevated above it (the dead-slab fix). */
.dark {
  --background: #0b1120;
  --foreground: #e6edf6;
  --card: #16203a;
  --card-foreground: #e6edf6;
  --popover: #16203a;
  --popover-foreground: #e6edf6;
  --primary: #e8eef7;
  --primary-foreground: #0f172a;
  --secondary: #1c2740;
  --secondary-foreground: #e6edf6;
  --muted: #1c2740;
  --muted-foreground: #8b9bb4;
  --accent: #233152;
  --accent-foreground: #e6edf6;
  --destructive: #ef4444;
  --destructive-foreground: #f8fafc;
  --border: #243149;
  --input: #243149;
  --ring: #cbd5e1;

  --info: #e6edf6;
  --info-foreground: #0b1120;
  --success: #e6edf6;
  --success-foreground: #0b1120;
  --warning: #e6edf6;
  --warning-foreground: #0b1120;

  --sidebar: #0e1626;
  --sidebar-foreground: #e6edf6;
  --sidebar-primary: #e8eef7;
  --sidebar-primary-foreground: #0f172a;
  --sidebar-accent: #233152;
  --sidebar-accent-foreground: #e6edf6;
  --sidebar-border: #243149;
  --sidebar-ring: #cbd5e1;
}

/* Map tokens to Tailwind's color/utility namespace. `inline` so .dark overrides apply. */
@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-info: var(--info);
  --color-info-foreground: var(--info-foreground);
  --color-success: var(--success);
  --color-success-foreground: var(--success-foreground);
  --color-warning: var(--warning);
  --color-warning-foreground: var(--warning-foreground);

  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);

  /* Fonts — variables are set by next/font in layout.tsx (Task 5). */
  --font-sans: var(--font-nunito), ui-sans-serif, system-ui, sans-serif;
  --font-heading: var(--font-nunito), ui-sans-serif, system-ui, sans-serif;
  --font-mono: var(--font-google-sans-code), ui-monospace, monospace;

  /* Radius scale (ported from the old preset). */
  --radius-lg: var(--radius);
  --radius-md: calc(var(--radius) - 2px);
  --radius-sm: calc(var(--radius) - 4px);

  /* DESIGN "Lift" shadow — card hover/focus. */
  --shadow-lift: 0 4px 12px rgb(2 8 23 / 0.08);

  /* Animations ported from the old preset (used by Radix overlays + crawl indicator). */
  --animate-accordion-down: accordion-down 0.2s ease-out;
  --animate-accordion-up: accordion-up 0.2s ease-out;
  --animate-pulse-border: pulse-border 1s ease-in-out infinite;
}

@keyframes accordion-down {
  from { height: 0; }
  to { height: var(--radix-accordion-content-height); }
}
@keyframes accordion-up {
  from { height: var(--radix-accordion-content-height); }
  to { height: 0; }
}
@keyframes pulse-border {
  0%, 100% { box-shadow: 0 0 0 0 gray; }
  50% { box-shadow: 0 0 0 2px gray; }
}

/* Container utility ported from the old preset (centered, 2rem padding, 1400px cap). */
@utility container {
  margin-inline: auto;
  padding-inline: 2rem;
  width: 100%;
  @media (width >= 1400px) {
    max-width: 1400px;
  }
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
  }
}

@layer components {
  /* Sleek scrollbar for the sidebar only (ported from the shared preset). */
  .sidebar-scrollbar::-webkit-scrollbar {
    width: 6px;
  }
  .sidebar-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }
  .sidebar-scrollbar::-webkit-scrollbar-thumb {
    background: rgb(100 116 139 / 0.15);
    border-radius: 3px;
  }
  .sidebar-scrollbar::-webkit-scrollbar-thumb:hover {
    background: rgb(100 116 139 / 0.25);
  }
  .sidebar-scrollbar {
    scrollbar-width: thin;
    scrollbar-color: rgb(100 116 139 / 0.15) transparent;
  }
}

/* Respect reduced-motion: neutralize transitions/animations app-wide while
   keeping transitionend/animationend firing (component logic depends on them). */
@media (prefers-reduced-motion: reduce) {
  *,
  ::before,
  ::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

- [ ] **Step 2: Commit** (the file isn't wired in until Task 5; commit it standalone)

```bash
git add apps/web/app/globals.css
git commit -m "feat(web): Tailwind v4 globals with Direction-A tokens (light + dark)"
```

---

## Task 4: Delete the JS Tailwind config and decouple from the shared preset

**Files:** delete `apps/web/tailwind.config.ts`; modify `apps/web/components.json`

- [ ] **Step 1: Delete the config**

```bash
git rm apps/web/tailwind.config.ts
```

(Safe now: Task 2 removed every `@/tailwind.config` importer, and v4 is CSS-first.)

- [ ] **Step 2: Update `components.json`**

In `apps/web/components.json`, change the `tailwind.config` value to an empty string (v4 has no JS config; the shadcn/coss CLI reads CSS):

```json
  "tailwind": {
    "config": "",
    "css": "app/globals.css",
    "baseColor": "slate",
    "cssVariables": true,
    "prefix": ""
  },
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/tailwind.config.ts apps/web/components.json
git commit -m "build(web): drop JS Tailwind config; CSS-first v4 setup"
```

---

## Task 5: Wire fonts and switch to the local globals

Replace Inter with **Nunito** (sans + heading) and **Google Sans Code** (mono) via `next/font/google`, and import the new local `globals.css` instead of the shared one.

**Files:** modify `apps/web/app/layout.tsx`

- [ ] **Step 1: Swap the font imports + stylesheet import**

In `apps/web/app/layout.tsx`, replace:

```ts
import { Inter } from "next/font/google";
...
import "@karakeep/tailwind-config/globals.css";
import "streamdown/styles.css";
```

with:

```ts
import { Google_Sans_Code, Nunito } from "next/font/google";
...
import "./globals.css";
import "streamdown/styles.css";
```

Replace the `inter` declaration:

```ts
const inter = Inter({
  subsets: ["latin"],
  fallback: ["sans-serif"],
});
```

with:

```ts
const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-nunito",
  fallback: ["system-ui", "sans-serif"],
});

const googleSansCode = Google_Sans_Code({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-google-sans-code",
  fallback: ["ui-monospace", "monospace"],
});
```

- [ ] **Step 2: Apply the font variables + `font-sans` on the document**

On the `<html>` tag, add the font variables to its className; on `<body>`, replace `inter.className` with `font-sans antialiased`:

```tsx
<html
  lang={userSettings.lang}
  dir={isRTL ? "rtl" : "ltr"}
  className={`${nunito.variable} ${googleSansCode.variable}`}
  suppressHydrationWarning
>
  <body className="font-sans antialiased">
```

- [ ] **Step 3: Verify the Google Sans Code import resolves**

Run:

```bash
pnpm -F @karakeep/web typecheck
```

Expected: PASS. **If** it fails with an "Unknown font `Google Sans Code`" error from `next/font/google` (the font is too new for this Next version's registry), fall back to a local font:
1. `mkdir -p apps/web/app/fonts` and download the woff2 files from the Google Fonts CSS (`https://fonts.googleapis.com/css2?family=Google+Sans+Code:wght@400;500`) into that folder.
2. Replace the `googleSansCode` declaration with:
   ```ts
   import localFont from "next/font/local";
   const googleSansCode = localFont({
     src: [
       { path: "./fonts/GoogleSansCode-Regular.woff2", weight: "400", style: "normal" },
       { path: "./fonts/GoogleSansCode-Medium.woff2", weight: "500", style: "normal" },
     ],
     variable: "--font-google-sans-code",
   });
   ```
   (Nunito stays on `next/font/google`.) Re-run typecheck; expect PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/layout.tsx
git commit -m "feat(web): Nunito (sans) + Google Sans Code (mono) via next/font; local globals"
```

---

## Task 6: Fix the canvas surface so cards separate in both themes

The dashboard's main scroll area is `bg-muted`. With Direction-A tokens, the canvas should be `--background` (cards then pop above it via `--card`). This single class change is what makes dark cards stop blending into the page.

**Files:** modify `apps/web/components/shared/sidebar/SidebarLayout.tsx`

- [ ] **Step 1: Change the main surface**

In `apps/web/components/shared/sidebar/SidebarLayout.tsx`, change the `<main>` className from:

```tsx
<main className="flex-1 bg-muted sm:min-h-0 sm:overflow-y-auto sm:rounded-tl-lg">
```

to:

```tsx
<main className="flex-1 bg-background sm:min-h-0 sm:overflow-y-auto sm:rounded-tl-lg">
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/shared/sidebar/SidebarLayout.tsx
git commit -m "fix(web): use the canvas token for the main area so cards separate (light + dark)"
```

*(Refining the header to `bg-card` and the sidebar to `bg-sidebar` for full layered depth is deferred to Phase 2 per-surface polish.)*

---

## Task 7: Update DESIGN.md to record the new system

The repo's `DESIGN.md` still says "Inter only" and describes the unimplemented monochrome tokens. Update the typography + colour sections to reflect Nunito / Google Sans Code and the Direction-A tokens now in `globals.css`.

**Files:** modify `DESIGN.md`

- [ ] **Step 1: Update the frontmatter + typography/colour prose**

In `DESIGN.md`:
- Change the `typography` block's `fontFamily` values from `"Inter, sans-serif"` to `"Nunito, sans-serif"`, and add a `mono: "Google Sans Code, monospace"` entry.
- In §3 Typography, replace the "One Voice Rule = Inter only" wording with: Nunito is the single UI typeface (sans + headings) and Google Sans Code is the mono face for `code`/`kbd`/`pre`; hierarchy comes from Nunito's weights (400–800) plus size and colour.
- In §2 Colors, note the resolved tokens now live in `apps/web/app/globals.css` as the Direction-A light/dark set (cool-grey canvas, white/elevated cards), keeping the navy + neutral monochrome and the Content-Is-Color rule.

Keep edits tight (this is a record, not a rewrite). No em dashes.

- [ ] **Step 2: Commit**

```bash
git add DESIGN.md
git commit -m "docs: update DESIGN.md for Nunito + Google Sans Code + Direction-A tokens"
```

---

## Task 8: Full verification (build + both themes)

**Files:** none (verification + final fixes only)

- [ ] **Step 1: Typecheck / lint / format**

```bash
pnpm -F @karakeep/web typecheck
pnpm -F @karakeep/web lint
pnpm -F @karakeep/web format:fix
```

Expected: typecheck PASS, lint `0 warnings and 0 errors`, format clean.

- [ ] **Step 2: Production build**

```bash
pnpm -F @karakeep/web build
```

Expected: build completes. **If** errors mention an unknown utility class (a v3→v4 rename), fix the offending class in-place and re-run. Most likely candidates and their v4 fixes: `outline-none` → `outline-hidden` (only where it meant "remove outline"); a bare `shadow` → `shadow-sm`, `shadow-sm` → `shadow-xs` (only if the diff is visually wrong — these still compile). Do not bulk-rename pre-emptively; fix only what the build flags.

- [ ] **Step 3: Visual check in both themes**

```bash
./start-dev.sh
```

Open `http://localhost:3000`, log in, then confirm on the **Home/bookmarks** page (and toggle the theme):
- **Light:** page canvas is a soft cool grey; bookmark cards are white and clearly lifted off it; text is crisp navy; metadata is readable grey.
- **Dark:** page canvas is deep navy-black; cards are visibly **lighter** than the page (no dead slab); borders/metadata are legible.
- **Fonts:** UI text is Nunito (rounded), with weight hierarchy (bold titles → regular body); any `kbd`/code is Google Sans Code.
- **Behaviour intact:** open a dropdown and a dialog — they still animate in/out (confirms `tw-animate-css`); the bookmark grid still lays out in columns (confirms the breakpoints refactor).

Stop with `./stop-dev.sh` when done.

- [ ] **Step 4: Final commit (only if Step 2/3 required fixes)**

```bash
git add -A
git commit -m "fix(web): resolve Tailwind v4 migration follow-ups"
```

(If no fixes were needed, skip — everything is already committed.)

---

## Self-review

**Spec coverage (Phase 0 portion of `2026-06-03-ui-haul-coss-design.md`):**
- TW3→v4 migration of apps/web → Tasks 1, 3, 4. ✓
- Decouple from shared preset (landing/extension stay v3) → Tasks 1 (remove dep), 4 (delete config), 5 (local globals import). ✓
- Direction-A tokens light+dark (exact spec values) → Task 3. ✓ (the dead-slab fix is completed by Task 6's `bg-background` change)
- coss token contract incl. foregrounds + status families (info/success/warning) + sidebar → Task 3. ✓
- Fonts: Nunito → `--font-sans`/`--font-heading`, Google Sans Code → `--font-mono` → Tasks 3 (mapping) + 5 (next/font). ✓
- Update DESIGN.md (supersedes Inter-only) → Task 7. ✓
- Layout unchanged, no push, local verification → Task 8. ✓
- **Deferred to later plans (correctly out of Phase 0 scope):** installing coss components / Sonner→toast (Phase 1); header/sidebar surface polish + per-page polish (Phases 2–4). Noted in the scope section.

**Placeholder scan:** No "TBD"/"handle edge cases"/"similar to". The one conditional (Google Sans Code fallback in Task 5 Step 3) is a complete alternative with real code, not a placeholder. The build-fix step (Task 8 Step 2) lists concrete known renames rather than "fix errors".

**Type/name consistency:** `SCREENS` constant + `{ sm, md, lg }` numeric usage is consistent across Tasks 2's three files. Font variables `--font-nunito` / `--font-google-sans-code` match between `globals.css` `@theme` (Task 3) and `next/font` `variable:` (Task 5). Token names in `:root`/`.dark` match their `@theme inline` `--color-*` mappings.

---

## Follow-up plans (after Phase 0 lands)

1. **Phase 1 — coss component migration:** register the `@coss` shadcn registry, `npx shadcn add @coss/*` to replace all 47 `components/ui/*`, rewrite consumers for Base UI API diffs (`asChild`→`render`, `onSelect`→`onClick`, Select items-first, etc.), migrate Sonner → coss `toastManager`. Planned once the v4 foundation exists and generated files are inspectable.
2. **Phase 2 — Home polish**, **Phase 3 — Search polish**, **Phase 4 — Folders/Lists polish:** per-surface Direction-A layering (header→`bg-card`, sidebar→`bg-sidebar`), spacing, and Nunito hierarchy.
