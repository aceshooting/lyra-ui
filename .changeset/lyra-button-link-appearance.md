---
"@aceshooting/lyra-ui": minor
---

Add `appearance="link"` to `<lyra-button>`: a true inline-link tier that renders as zero-chrome underlined text — no padding, border, border-radius, or `min-block-size` floor — colored from the same `--lyra-button-accent` token `appearance="plain"` uses (so `variant` still selects the link color) and inheriting the surrounding font-size/weight so it flows within a sentence rather than as a button-shaped control. Previously the smallest `<lyra-button>` was still a padded, rounded, 24px-tall pill with a (transparent-but-present) border and no `text-decoration`, so an inline text link had to be hand-rolled; `appearance="link"` now covers that case directly. The notable design choice: the link rules are declared after the per-`size` rules so `font: inherit` and the zero padding/border/min-height win over whatever `size` is set, and the shared `[part='base']:focus-visible` outline is deliberately left intact.
