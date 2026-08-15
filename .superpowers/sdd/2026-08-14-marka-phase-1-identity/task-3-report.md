# Task 3 report: visible web copy rebrand

## Status

Complete. The scoped web titles and direct UI copy use `MARKA.name`; Wrapped download and share text use Marka; every locale's `wrapped.subtitle` and `wrapped.footer` contains Marka. Profile links retain their upstream Karakeep URLs with explicit upstream labels.

## Commit

`feat(web): rebrand visible copy to Marka`

## Checker allowlist

- `apps/web/app/api/bookmarks/export/route.tsx`: `karakeep-export-<timestamp>.json`, the legacy-compatible export filename.
- `apps/web/components/admin/BasicStats.tsx`: the upstream release API and release-page URLs.
- `apps/web/components/dashboard/header/ProfileOptions.tsx`: the three upstream Karakeep destination URLs and their three explicit upstream labels.
- Every `apps/web/lib/i18n/locales/*/translation.json`: the unchanged `import_bookmarks_from_karakeep_export` key and its legacy-compatible import-format label.

## Verification

- Red: `mise exec node@24 -- node scripts/check-marka-phase-one.mjs` exited 1 before rebranding because `SignInForm.tsx` still contained `Karakeep`.
- Green: `mise exec node@24 -- node scripts/check-marka-phase-one.mjs` passed its required SignInForm, WrappedContent, and export-filename assertions and reported only the allowlist above.
- Green: `mise exec node@24 -- pnpm --filter @karakeep/web test --run` passed 32 files and 148 tests.
- Green: `mise exec node@24 -- pnpm --filter @karakeep/web lint` completed with 0 errors.
- Green: `mise exec node@24 -- pnpm --filter @karakeep/web typecheck` completed successfully.

## Concerns

Lint retains two non-failing `no-img-element` advisories in the Task 2 `MarkaLogo` component. This task did not change that component.
