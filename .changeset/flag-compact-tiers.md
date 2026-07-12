---
"@aceshooting/lyra-flags": minor
"@aceshooting/lyra-ui": minor
---

Add a `compact` flag tier and expose three fidelity tiers via `variant`.

`@aceshooting/lyra-flags`: the ~65 emblem flags now ship a tiny WebP raster at
`flags/compact/<code>.webp` (~1–3 KB) alongside the standard vector and the pristine `detailed`
original. `flagUrl(code, { variant: 'compact' | 'standard' | 'detailed' })` selects a tier,
code-split per flag *and* per tier so a bundled app ships only the tiers it actually uses. The
`standard` tier was also re-derived from the pristine originals so every flag is now under 80 KB
(no fidelity loss perceptible at card/row scale).

`@aceshooting/lyra-ui`: `<lyra-flag>` gains a `variant="compact" | "standard" | "detailed"`
property — a tiny raster for icon-scale use (menu items, language selectors), the default
icon-optimized vector for card/row sizes, or the pristine full-detail vector for hero display.
The `detailed` boolean is deprecated but kept working as an alias for `variant="detailed"`.
