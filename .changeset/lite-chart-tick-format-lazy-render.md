---
"@aceshooting/lyra-ui": minor
---

`<lyra-lite-chart>`: added `tickFormat?: (value: number) => string` to customize y-axis tick label
formatting (e.g. currency, duration) instead of the built-in nice-number formatter. Also added
`IntersectionObserver`-gated lazy rendering and content-signature memoization — a chart skips
recomputing its grid/marks while scrolled off-screen or when none of its content-affecting properties
(`type`, `labels`, `datasets`, `legend`, `xLabel`, `yLabel`, `beginAtZero`, `stacked`, plot size) have
actually changed since the last render.
