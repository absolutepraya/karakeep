# Header and favicon feedback report

- Replaced the dashboard header's fixed `w-56` logo slot with an explicitly left-aligned Marka link. Its theme-aware wordmarks now render at a CSS-enforced 28px height while the header remains 64px and the existing mobile breakpoint still hides the logo.
- Increased only the two favicon source records from 8% to 16% padding, regenerated `marka-favicon-light.png` and `marka-favicon-dark.png`, and refreshed their matching review exports in `/Users/absolutepraya/Downloads/assets`.
- Preserved all supplied source bytes, transparent wordmarks, PWA icons, navigation destination, and search layout.
- Added focused header coverage for the compact left-aligned wordmark and fixed-slot removal. The asset test now requires 16% padding for both favicon outputs.
- Collaborative preview verification: desktop rendered a 64px header with a 28px by 100.9px wordmark and expanded search field; iPhone 12 Pro mobile kept the logo hidden with the search and controls intact. Light used the navy wordmark and dark used the white wordmark.

## Verification

- `mise exec node@24 -- pnpm test:marka-assets` passed, 8 tests including source-byte and favicon-corner checks.
- `mise exec node@24 -- pnpm --filter @karakeep/web test --run components/MarkaLogo.test.tsx components/dashboard/header/Header.test.tsx` passed, 2 tests.
- `mise exec node@24 -- pnpm --filter @karakeep/web format`, `lint`, and `typecheck` passed. Lint retained the pre-existing two `MarkaLogo` `no-img-element` warnings.
- `git diff --check` passed.
- The regenerated favicon checksums match their Downloads review exports: light `00f431144b889c38df838153a9f4d12f6a1b3cbe03562651acd203a1b14e26ce`, dark `5813b18faa66a85ba426a6233fbe9cbb3c14443149b61b77eb1b3f305a43a79e`.
