---
"@aceshooting/lyra-ui": minor
---

Added `--lr-focus-ring`, a composite outline shorthand (`var(--lr-focus-ring-width) solid
var(--lr-focus-ring-color)`) alongside the three existing parts, which stay exactly as they are.

Web Awesome exposes `--wa-focus-ring` as a ready-made outline value, so the common consumer idiom
is `outline: var(--wa-focus-ring)`. Migrating it meant hand-expanding every site, which is easy to
get subtly wrong — omitting the `solid` keyword yields an outline that renders in some engines and
not others — and each hand-expanded copy stops tracking any future change to how the ring is
composed. `--lr-focus-ring-offset` stays separate because `outline-offset` is its own property, not
part of the `outline` shorthand.

`llms/tokens.md` also now documents why an ancestor `--lr-*` override does not survive a nested
component boundary: every component re-derives that layer from `--lr-theme-*` on its own `:host`,
so the override is reset at the first `lr-*` inside another `lr-*`'s shadow root and degrades
silently. The `--lr-theme-*` input layer is the one that inherits.
