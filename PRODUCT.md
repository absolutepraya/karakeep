# Product

## Register

product

## Users

A single owner of a self-hosted Karakeep instance (this is a personal fork, not an upstream contribution). The primary user is the operator-owner who lives in the app daily on desktop and mobile. Their context: they come across a link, image, or note and want it **saved in one or two actions, with zero ceremony**, then come back days or weeks later to **find that thing again fast** when they actually need it.

The job to be done is two-sided and asymmetric:
- **Capture** (high frequency, must be instant): save a bookmark and move on. AI tagging/summarization happens in the background; the user does not babysit it.
- **Retrieve** (the payoff): search, filter, and scan a large personal collection to surface the right item quickly. This is where the app earns its keep.

In-app long-form reading is explicitly **not** the primary workflow. The app is a library and a search engine over a personal hoard, not a reader.

## Product Purpose

Karakeep is a self-hostable "bookmark-everything" app: links, notes, images, and PDFs, with background AI tagging and summarization, full-text search, lists, and rule-based organization. This fork serves one person's collection and runs on their own infrastructure.

Success looks like: saving is so frictionless it becomes reflexive, and retrieval is so reliable the user trusts the app as the place their information lives. The interface should make a large collection feel navigable rather than overwhelming, and make the act of saving feel instant and certain.

## Brand Personality

Three words: **precise, premium, personal.**

- **Precise** — fast, dense where density helps, keyboard-friendly, exact. A daily-driver tool that respects the user's time and rewards fluency.
- **Premium** — visibly crafted. Considered spacing, type, and motion. Refined detail, not decoration. It should look like someone cared, not like a starter template.
- **Personal** — this is *my* library, not a corporate dashboard. Warmth and a sense of ownership over neutral enterprise chrome.

Voice and tone: direct and unfussy, written for the person who owns the data. Labels say exactly what will happen; no marketing gloss (the user is the audience, not a prospect).

## Anti-references

- **The untouched shadcn / slate starter.** The current theme is stock shadcn with no identity. The redesign must not still read as "default shadcn demo."
- **The overly-minimal "demo" look.** Bare, empty, under-furnished layouts that read as unfinished or hard to scan. The user wants it *nice and easy to see*, with substance, not stripped to nothing.
- **The heavy SaaS dashboard.** Gradient hero-metric blocks, endless identical icon-heading-text card grids, and busy chrome that competes with the actual content.
- **Toy / playful consumer app.** Bouncy/elastic motion, over-rounded shapes, emoji-as-UI, unserious framing for a tool the user relies on every day.
- **Reading-app-first layouts.** Anything that optimizes the long-form reading experience at the expense of save speed and search/scan quality. Capture and retrieval come first.

## Design Principles

1. **Capture is instant; retrieval is effortless.** The two jobs that matter are saving fast and finding later. Every screen is judged on whether it speeds one of those. Reading is secondary.
2. **A personal library, not a corporate dashboard.** Optimize for the feeling of owning and browsing *your* collection. Warmth and identity over neutral enterprise chrome.
3. **Precise, but never bare.** Dense, fast, and exact for a tool used daily, yet visibly crafted. Avoid both extremes: the untouched-shadcn look and the stripped-to-nothing minimal demo.
4. **Keep the navy; earn the identity through craft.** The existing navy/slate colorway stays. Distinctiveness comes from refined typography, spacing rhythm, motion, and considered detail, not a palette swap.
5. **The bookmarks are the content.** Saved items (titles, images, tags, sources) carry the visual weight. Chrome recedes so a large collection stays scannable.

## Accessibility & Inclusion

Target **WCAG 2.1 AA**:
- Body text ≥ 4.5:1 contrast against its background; large/bold text ≥ 3:1. Placeholder and metadata text held to the same body standard, not faint gray.
- Full keyboard operability with a visible, non-default focus indicator on every interactive element.
- Every animation has a `prefers-reduced-motion: reduce` alternative (crossfade or instant).
- Parity across light and dark themes (both are first-class; the app ships both).
- Don't rely on color alone to convey state (tags, status, selection also use shape, text, or icon).
- RTL is supported (the app already runs `dir="rtl"` for Arabic); layout work must not break it.
