---
"@aceshooting/lyra-ui": patch
---

Stop driving mask alpha from `--lr-color-shadow` in `<lr-segmented>`, `<lr-tabs>`, `<lr-stepper>`,
`<lr-timeline>` and `<lr-document-preview>`. All five used `var(--lr-color-shadow)` for the
*opaque* stops of a `mask-image` gradient — 22 references across 12 declarations. A mask reads
alpha only, but that token is a documented consumer theming input (`--lr-theme-color-shadow`) whose
job is coloring shadows: setting it to something translucent such as `rgb(0 0 0 / 0.25)`, entirely
reasonable for a shadow color, silently dropped the mask alpha across the *entire* element rather
than just its edges. Every affected component then rendered uniformly washed out — indistinguishable
from a broken disabled state, with nothing pointing back at the shadow token as the cause. It worked
only because that token's default happens to be opaque black.

The opaque stops now use a new `--lr-mask-opaque`, declared in the internal tokens sheet.
Deliberately **not** themeable and deliberately not a second alias of the shadow token: "opaque" is
not a design decision a consumer tunes — a mask's opaque stop must be opaque by definition — so
giving it its own `--lr-theme-*` hook would just reintroduce the same footgun under a new name.

`<lr-document-preview>`'s determinate progress ring was the least obvious casualty: its mask punches
the ring's centre out, so a translucent shadow theme faded the whole ring rather than cutting a hole
in it.

Regression-tested in all five components by rendering under `--lr-theme-color-shadow: rgb(0 0 0 /
0.25)` and asserting the resolved computed mask, which reproduces `rgba(0, 0, 0, 0.25)` at the
opaque stops without the fix.
