# `@karakeep/landing`

This is the Astro-based marketing / landing site for Karakeep.

## Local development

From the repository root:

```bash
pnpm --filter @karakeep/landing dev
```

Other useful commands:

```bash
pnpm --filter @karakeep/landing build
pnpm --filter @karakeep/landing preview
pnpm --filter @karakeep/landing lint
pnpm --filter @karakeep/landing format:fix
pnpm --filter @karakeep/landing typecheck
```

## Notes

- This package is separate from the main web app in `apps/web`.
- It is mostly relevant when changing marketing pages, homepage copy, or public brand assets.
- For product/docs/deploy workflow of this fork, start from the root `README.md` and `docs/fork-setup.md` instead.
