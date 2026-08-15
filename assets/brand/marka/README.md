# Marka brand assets

The six PNG files in `source/` are unchanged copies of the approved artwork from `/Users/absolutepraya/Downloads`. They are the canonical source assets for this repository. Do not edit them, trace them, or convert them to SVG.

| Tracked source | Downloaded original |
| --- | --- |
| `marka-navy-mark.png` | `ChatGPT Image Aug 14, 2026, 09_20_54 AM (2).png` |
| `marka-navy-wordmark.png` | `ChatGPT Image Aug 14, 2026, 09_20_54 AM (3).png` |
| `marka-navy-app-icon.png` | `ChatGPT Image Aug 14, 2026, 09_20_55 AM (4).png` |
| `marka-white-mark.png` | `ChatGPT Image Aug 14, 2026, 09_20_56 AM (6).png` |
| `marka-white-wordmark.png` | `ChatGPT Image Aug 14, 2026, 09_20_57 AM (7).png` |
| `marka-white-app-icon.png` | `ChatGPT Image Aug 14, 2026, 09_20_57 AM (8).png` |

`manifest.json` records the exact crops, backgrounds, optical padding, and generated outputs. Generated artwork is normalized to the approved `#03132F` navy and `#FFFFFF` white palette. The white rounded-square app icon is retained as an approved inverse source asset; Phase 1 does not yet have a generated consumer for it.

Regenerate all checked-in derivatives with:

```sh
mise exec node@24 -- pnpm assets:marka
```

The generator writes web, landing, docs, and repository-preview PNGs, then uses macOS `sips` to encode `apps/web/app/favicon.ico` from `marka-icon-48.png`. The manifest is the output map and records each output's source and dimensions.

Publishing a fork-owned landing site, documentation site, or external infrastructure change remains deferred to issues #25, #26, and #27. This asset pipeline does not change domains, deployment, Docker, GHCR, or Karakeep compatibility identifiers.
