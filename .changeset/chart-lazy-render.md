---
"@aceshooting/lyra-ui": minor
---

`<lyra-chart>`: added `IntersectionObserver`-gated lazy redraw and content-signature memoization — a
chart skips calling into Chart.js while scrolled off-screen (redrawing once when it re-enters the
viewport) or when none of its content-affecting properties (`type`, `labels`, `datasets`, `legend`,
`area`, `xLabel`, `yLabel`, `y2Label`, `beginAtZero`, `horizontal`, `stacked`, `config`) have actually
changed since the last draw. `refreshTheme()` is unaffected and always redraws.
