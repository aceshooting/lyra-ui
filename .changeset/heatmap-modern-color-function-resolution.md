---
"@aceshooting/lyra-ui": patch
---

Fix `<lr-heatmap>` silently substituting the built-in fallback ramp color whenever
`--lr-heatmap-scale-lo`/`-hi` (or a `colorSteps` entry) was set to a modern CSS color function --
`color-mix()`, `oklch()`, `lab()`, `color(display-p3 ...)`, etc. -- with no warning. `resolveRgb()`
previously re-parsed the canvas's `ctx.fillStyle` read-back as a string (hex or `rgb()`/`rgba()`
only), which neither recognizes the `color(srgb r g b [/ a])` form Chromium normalizes
`color-mix()` to, nor the literal `oklch()`/`lab()`/`color(display-p3 ...)` syntax canvas
round-trips as-is for those functions. It now falls back to reading the actual rendered pixel back
via `getImageData(0, 0, 1, 1)` -- the same idiom already used in `theme.ts`/`shiki-dark-theme.ts`/
`color-core.ts` -- resolving any CSS color syntax the canvas accepts instead of only the forms a
hand-written parser recognizes. A genuinely invalid color string is unaffected: it still triggers
`warnInvalidColor()` and falls back.
