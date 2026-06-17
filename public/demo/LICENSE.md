# Demo backdrop image — source & license

`showcase-backdrop.webp` (1600×1000) is a **synthetic, self-authored** image
generated programmatically for this repository's Storybook demos. It is NOT a
photograph and contains no third-party or copyrighted content.

- **Source:** procedurally generated — a vivid mesh-gradient base composited
  with sharp-edged rectangles, crisp circles, a high-frequency stripe band, and
  a faint grid. The high-frequency color + edges + varied regions make the
  `<LiquidGlass>` refraction edge-bending obvious.
- **Generator:** deterministic Python (seed `1509`), rasterized to PNG, then
  encoded to optimized WEBP with `cwebp -q 82 -m 6`.
- **License:** dedicated to the public domain under
  [CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). No attribution
  required. You may copy, modify, and redistribute it for any purpose.

The asset is bundled in the repo and served **same-origin** by Storybook (wired
via `staticDirs` in `.storybook/main.ts`), so demos can sample it via canvas
without cross-origin taint.
