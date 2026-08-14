# Header wordmark trim report

- Trimmed only the transparent Marka wordmark outputs. The initial ImageMagick bounds were `510x135+44+15`; the regenerated PNG canvases are `510x135` with no transparent border.
- Added explicit `trim: true` declarations for the web, landing, documentation, and screenshot transparent wordmarks. Social cards, PWA icons, and favicon assets have no trim declarations and were not regenerated.
- The generator now stages `magick <input> -trim -strip <output>`, then re-encodes the staged image deterministically. This preserves ImageMagick trim geometry without nondeterministic metadata.
- The navy and white web header wordmarks retain matching 510px by 135px RGBA alpha geometry and their exact approved navy and white pixel colors.
- Refreshed the matching Downloads review assets: `marka-wordmark-navy.png`, `marka-wordmark-white.png`, and `marka-logo.png`.

## Verification

- `mise exec node@24 -- pnpm test:marka-assets` passed, 9 tests, including source-byte preservation and deterministic regeneration.
- `mise exec node@24 -- pnpm assets:marka` regenerated only the declared transparent wordmark derivatives.
- `magick identify` confirmed both web wordmarks are `510x135`.
- The regenerated web and Downloads checksums match: navy `f547666c3fa553d208358f4de780475a0599ebedd8b53628c3b44eae70a4546a`, white `b054866ca88dda3ade7725866f58ec48f23ad3372993a2d34df65db7e0744795`.
