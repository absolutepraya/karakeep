---
name: Karakeep
description: A precise, premium, personal library for saving and finding everything you hoard.
colors:
  midnight-ink: "#0f172a"
  ink: "#020817"
  paper: "#ffffff"
  frost: "#f8fafc"
  slate-mist: "#f1f5f9"
  slate-line: "#e2e8f0"
  slate-quiet: "#64748b"
  slate-deep: "#1e293b"
  slate-haze: "#94a3b8"
  signal-red: "#ef4444"
  signal-red-deep: "#cc1717"
typography:
  headline:
    fontFamily: "Inter, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Inter, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.0125em"
  body:
    fontFamily: "Inter, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.43
    letterSpacing: "normal"
  label:
    fontFamily: "Inter, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "normal"
rounded:
  sm: "4px"
  md: "6px"
  lg: "8px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
components:
  button-primary:
    backgroundColor: "{colors.midnight-ink}"
    textColor: "{colors.frost}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "40px"
  button-secondary:
    backgroundColor: "{colors.slate-mist}"
    textColor: "{colors.midnight-ink}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "40px"
  button-ghost:
    textColor: "{colors.midnight-ink}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "40px"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "40px"
  card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "24px"
  bookmark-card:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "8px"
  badge:
    backgroundColor: "{colors.midnight-ink}"
    textColor: "{colors.frost}"
    rounded: "{rounded.full}"
    padding: "2px 10px"
---

# Design System: Karakeep

## 1. Overview

**Creative North Star: "The Curator's Desk"**

Karakeep is the desk where one person keeps everything worth keeping. Not a corporate dashboard, not a public feed: a private, premium workspace where every saved thing has a place and is fast to reach. The room is dark slate and clean paper; the light falls on the work, not the furniture. Two motions define it: dropping something onto the desk (capture, instant, no ceremony) and reaching back for it later (retrieve, reliable, fast). Everything visual serves one of those two motions.

The system is monochromatic on purpose. Navy (**Midnight Ink**, `#0f172a`) and a quiet neutral ramp carry the entire interface, so that the only saturated color on a normal screen comes from the saved content itself: a thumbnail, a favicon, a cover image. The chrome recedes; the collection glows. This is the opposite of a SaaS dashboard that drowns its own data in branded gradients and metric cards.

It rejects, by name, five things from the product brief. It is not the **untouched shadcn / slate starter**: identity comes from rhythm, density, and considered detail, not the default theme left alone. It is not a **bare minimal demo**: it is nice to look at and easy to scan, with substance. It is not a **heavy SaaS dashboard**: no gradient hero-metrics, no endless identical card grids competing with content. It is not a **toy**: no bouncy motion, no emoji-as-UI. And it is not **reading-app-first**: capture speed and scan/search quality always win over a long-form reading experience.

**Key Characteristics:**
- Monochrome navy + neutral chrome; saved content is the only color that matters.
- Flat at rest, lifting only when touched.
- Tactile, confident components with decisive states.
- One typeface (Inter), hierarchy from weight and size.
- Dense where density helps retrieval; calm everywhere else.
- Full light/dark parity; both themes are first-class.

## 2. Colors

A near-monochrome navy-and-neutral system. One brand hue (navy), one ramp of cool slate neutrals, and a single red reserved strictly for destruction. Tokens are defined as HSL CSS custom properties (`--primary`, `--background`, …); the hex values below are their resolved sRGB equivalents.

### Primary
- **Midnight Ink** (`#0f172a` / `--primary: 222.2 47.4% 11.2%`): the signature navy. Primary buttons, badges, active emphasis, and the foreground of headings in light mode. In dark mode the roles invert: Midnight Ink becomes the resting surface and **Frost** becomes the primary fill, which is the intended shadcn inversion, not an accident.

### Neutral
- **Ink** (`#020817` / `--foreground: 222.2 84% 4.9%`): the deepest navy-black. Body and heading text on light surfaces; the full-bleed app background in dark mode (`--background`).
- **Paper** (`#ffffff` / `--background`, `--card`): the light-mode canvas and card surface. Clean, not cream, never warm-tinted.
- **Frost** (`#f8fafc` / `--primary-foreground`): near-white with a cool cast. Text on navy, and the primary surface in dark mode.
- **Slate Mist** (`#f1f5f9` / `--secondary`, `--muted`, `--accent`): the light-mode hover and secondary-surface tint. Sidebar item hover, secondary buttons, muted blocks.
- **Slate Line** (`#e2e8f0` / `--border`, `--input`): hairline borders and input strokes in light mode. The system leans on this for structure.
- **Slate Quiet** (`#64748b` / `--muted-foreground`): metadata, captions, timestamps, placeholder text in light mode. Held to a real contrast bar, never faint decoration (see Do's and Don'ts).
- **Slate Deep** (`#1e293b` / dark `--secondary`, `--muted`, `--accent`, `--border`): the dark-mode equivalent of Slate Mist and Slate Line in one tone. Hover tint, secondary surface, and border in dark mode.
- **Slate Haze** (`#94a3b8` / dark `--muted-foreground`): metadata and secondary text in dark mode.

### Status
- **Signal Red** (`#ef4444` light / **Signal Red Deep** `#cc1717` dark, `--destructive`): the only chromatic break from the monochrome. Reserved exclusively for destructive and error states.

### Named Rules
**The Content-Is-Color Rule.** The chrome is navy and neutral, full stop. The only saturated color on an ordinary screen comes from the saved bookmarks themselves: thumbnails, favicons, cover art. Never introduce a decorative accent hue to "brighten things up"; that brightness is the user's content's job.

**The Red-Means-Destroy Rule.** Signal Red appears only on destructive actions and error states (delete, remove, failed crawl). It is never a brand accent, never a highlight, never decorative. If red is on screen, something is about to be lost or has gone wrong.

## 3. Typography

**Display / Body / Label Font:** Inter (with `sans-serif` fallback), loaded via `next/font`.

**Character:** One typeface, tuned hard. Inter is neutral, legible at dense sizes, and disappears into the content, which is exactly right for a tool you read *through*, not *at*. Hierarchy is built entirely from weight and size contrast, never from a second face. This is the discipline that keeps "precise" from tipping into "decorated."

### Hierarchy
- **Headline** (Inter 600, 1.5rem / 24px, line-height 1, letter-spacing -0.025em): card titles, section and page headings. Tight tracking gives it a deliberate, set-on-the-page feel.
- **Title** (Inter 600, 1.125rem / 18px): sub-section headers, dialog titles, list group labels.
- **Body** (Inter 400, 0.875rem / 14px, line-height 1.43): the workhorse. Nearly all UI text. Long-form note/markdown content steps up to 16px and is capped at 65–75ch for readability.
- **Label** (Inter 600, 0.75rem / 12px): badges, tags, metadata, and uppercase-free micro-labels. Buttons use 14px / 500 (medium), one notch lighter than headings.

### Named Rules
**The One Voice Rule.** Inter is the only typeface in the product. No second display serif, no "fun" accent face, no mono except inside actual code/kbd elements. Distinctiveness is earned through weight, size, and spacing, never through font roulette.

**The Sentence-Case Rule.** Labels and buttons are sentence case or short Title Case, never ALL CAPS body. Uppercase is allowed only on micro-labels of ≤4 words (a `kbd` chip, a status pill), never on sentences.

## 4. Elevation

Flat by default; depth is a response to interaction, not an ambient texture. At rest, surfaces are separated by hairline borders (Slate Line / Slate Deep) and tonal layering, not drop shadows. The signature bookmark card sits flat in the grid and earns its lift only on hover, focus, or drag. This keeps a dense collection calm: a wall of cards with permanent shadows reads as noise.

### Shadow Vocabulary
- **Resting** (`box-shadow: none`; border `1px solid var(--border)`): the default for cards, inputs, and containers. Structure comes from the border.
- **Lift** (`box-shadow: 0 4px 12px rgba(2, 8, 23, 0.08)`): applied on hover/focus of an interactive card. Soft, navy-tinted, low. The desk picking the card up an inch toward you.
- **Drag** (`box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15)`): the floating pill shown while dragging a bookmark; slightly stronger so it reads as "in hand."
- **Action overlay** (`backdrop-filter: blur(4px)`; `background: rgba(255,255,255,0.5)` light / `rgba(0,0,0,0.5)` dark): the hover-revealed action cluster over a card image. This is the one sanctioned use of blur/glass: a functional scrim that keeps icon affordances legible over arbitrary thumbnails, not decoration.

### Named Rules
**The Flat-At-Rest Rule.** Surfaces carry no drop shadow at rest. If you see a shadow, the element is being hovered, focused, or dragged. A shadow that's always on is a bug, not a style.

## 5. Components

Components feel **tactile and confident**: clear affordances, decisive states, satisfying feedback. Nothing is ambiguous about what's clickable or what just happened.

### Buttons
- **Shape:** Gently rounded (6px, `rounded-md`). Height 40px default (`h-10`), with `sm` (36px) and `lg` (44px) steps, plus square icon sizes (`size-10` / `size-8` / `size-6`).
- **Primary:** Midnight Ink fill, Frost text, 14px/500. `padding: 8px 16px`. Hover darkens the navy slightly (`primary/90`).
- **Secondary:** Slate Mist fill, Midnight Ink text; hover deepens to `secondary/80`.
- **Outline / Border:** transparent fill, Slate Line border; hover fills with the accent tint and switches to accent-foreground text.
- **Ghost:** no fill or border; hover picks up the accent tint. Used for dense, low-emphasis actions (card toolbars, list rows). Ghost suppresses the focus ring offset to stay tight in toolbars.
- **Destructive / Destructive-outline / Ghost-destructive:** Signal Red family, governed by the Red-Means-Destroy Rule.
- **Hover / Focus:** color transition only (`transition-colors`); a visible `ring-2 ring-ring ring-offset-2` focus ring on keyboard focus. Never animate layout or bounce.

### Chips / Tags / Badges
- **Style:** fully rounded pill (`rounded-full`), 12px/600 label, `padding: 2px 10px`, transparent border.
- **Variants:** `default` (Midnight Ink fill, Frost text), `secondary` (Slate Mist), `destructive` (Signal Red), `outline` (text-only, no fill). Hover softens the fill to ~80% opacity.
- **Role:** tags on bookmarks, counts, and status. Tags are the spine of retrieval, so they stay crisp and high-contrast, never faint.

### Cards / Containers
- **Corner Style:** 8px (`rounded-lg`).
- **Background:** Paper (light) / Ink (dark), via `--card`.
- **Border:** `1px solid var(--border)` (Slate Line / Slate Deep). This is the primary separator.
- **Shadow Strategy:** none at rest; **Lift** on hover/focus per the Elevation section.
- **Internal Padding:** 24px (`p-6`) for content/settings cards; the bookmark grid card uses a tighter 8px (`p-2`) frame so the thumbnail dominates.

### Inputs / Fields
- **Style:** 40px tall, Paper background, `1px solid var(--input)` stroke, 6px radius, 14px text. Optional leading/trailing icon slots.
- **Focus:** `focus-visible:ring-1 ring-ring`, outline removed, no offset; a quiet, exact focus that doesn't jump.
- **Placeholder:** Slate Quiet, held to the same body-contrast bar as real text.
- **Disabled:** 50% opacity, `cursor-not-allowed`.

### Navigation (Sidebar)
- **Style:** vertical list of `rounded-lg` items, 14px text, `px-3 py-2`. Default state is Slate Quiet (muted) text; hover fills with the accent tint (`hover:bg-accent`); the active route gets `bg-accent/50` and full-strength foreground text.
- **Affordances:** drag-drop targets get a `ring-2 ring-primary` highlight. A custom thin scrollbar (`--muted-foreground` at 15% alpha) keeps the rail quiet.
- **Mobile:** collapses to a sheet/drawer; same item styling.

### Bookmark Card (Signature Component)
The heart of the product: the unit of the collection. A flat, `overflow-hidden rounded-lg` card that adapts across grid, list, and compact layouts. In grid layout the cover image sits on top (`h-56`, `rounded-t-lg`), title and source/date footer below, tags inline. Every secondary affordance, the action bar, drag handle, owner indicator, and selection checkbox, is **hidden at rest** (`opacity-0`) and revealed on `group-hover` with a 200ms opacity transition. Pointer-fine devices only, so touch layouts stay clean. At rest it is a calm, scannable tile; on approach it becomes a full control surface.

**The Hover-Reveals Rule.** Card chrome is invisible until hover. The resting state shows only content (image, title, source, tags); controls appear on approach. This is how a dense wall of bookmarks stays scannable instead of becoming a field of buttons.

## 6. Do's and Don'ts

### Do:
- **Do** keep navy + neutral as the entire chrome, and let saved content (thumbnails, favicons) be the only saturated color on screen (the Content-Is-Color Rule).
- **Do** separate surfaces with `1px solid var(--border)` and keep them flat at rest; reserve shadow for hover, focus, and drag (the Flat-At-Rest Rule).
- **Do** build hierarchy from Inter weight + size alone (the One Voice Rule).
- **Do** hold metadata, captions, and placeholders to ≥4.5:1 contrast. Use Slate Quiet (`#64748b`) / Slate Haze (`#94a3b8`) deliberately, and bump toward Ink/Frost if a tint pulls them under the bar.
- **Do** keep every animation to `transition-colors` / opacity with an `ease-out` curve, and give each a `prefers-reduced-motion: reduce` fallback.
- **Do** maintain full keyboard operability with a visible `ring-2 ring-ring` focus ring, and keep light/dark at parity.
- **Do** reserve Signal Red for destructive and error states only (the Red-Means-Destroy Rule).
- **Do** hide secondary card actions until hover so dense collections stay scannable (the Hover-Reveals Rule).

### Don't:
- **Don't** ship the untouched shadcn / slate starter look. If a screen could be any default shadcn demo, it has no identity yet.
- **Don't** strip a screen to a bare, under-furnished minimal demo. Nice and easy to see, with substance, beats empty.
- **Don't** build a heavy SaaS dashboard: no gradient hero-metric blocks, no endless identical icon-heading-text card grids, no chrome that competes with the content.
- **Don't** make it a toy: no bouncy/elastic motion, no over-rounded blobs, no emoji-as-UI.
- **Don't** optimize a screen for long-form reading at the expense of save speed or scan/search quality. Capture and retrieval come first.
- **Don't** use a `border-left`/`border-right` greater than 1px as a colored accent stripe on cards, list items, or alerts. Use full borders, tints, or leading icons.
- **Don't** use gradient text (`background-clip: text`), and don't introduce a second decorative accent hue.
- **Don't** apply blur/glass as decoration. The only sanctioned glass is the functional action-overlay scrim over card images.
- **Don't** let any surface carry a permanent drop shadow, and don't use arbitrary z-index values (999/9999); use the semantic scale (dropdown → sticky → modal-backdrop → modal → toast → tooltip).
- **Don't** set sentences in ALL CAPS; reserve uppercase for ≤4-word micro-labels.
