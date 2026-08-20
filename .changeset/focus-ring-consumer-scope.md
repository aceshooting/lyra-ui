---
"@aceshooting/lyra-ui": patch
---

**Fixes a silent focus-ring regression introduced in 11.0.0.** `--lr-focus-ring` was added as a
composite outline shorthand explicitly to replace the Web Awesome `outline: var(--wa-focus-ring)`
idiom — but it was declared only inside each component's `:host`, and that idiom is written by a
consumer against their *own* element. At document scope the token resolved to the empty string,
which makes the whole `outline` declaration invalid at computed-value time; because `outline` does
not inherit, the ring did not fall back, it **disappeared**. No console warning, no test signal —
a WCAG 2.4.7 failure that looked correct in review. The library evidenced the gap itself:
`styles/native.css` hand-expanded the ring rather than using the composite.

`theme.css` now declares `--lr-focus-ring` and its three parts at document scope, on `:root` and on
both mode selectors — not `:root` alone, because `.lr-dark` / `[data-lr-theme='dark']` may sit on
any ancestor, and resolving the colour once at `:root` would freeze the light value for a subtree
that later switches. Components are unaffected: their own `:host` declarations still win, which is
now asserted.

`styles/native.css` deliberately keeps its fallback-chained expansion so it continues to work for
consumers who load it without `theme.css`.

Reported twice independently, with a live `getComputedStyle` repro showing `outlineStyle: "none"`.
