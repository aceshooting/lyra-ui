---
"@aceshooting/lyra-ui": patch
---

Fix `<lr-multi-split>`'s `'floating'` collapse state requiring `!important` to override its
drawer's `position`/`inset-block`/`inset-inline-start`/`inset-inline-end`. All four were applied
as owned *inline* styles — always higher cascade priority than any external stylesheet rule,
regardless of specificity — even though their floating-state value is always the same fixed
literal (`absolute`, `0`), never per-render computed data. They're ordinary (overridable)
stylesheet rules now, keyed off the already-reflected `collapse` host attribute and the panel's
existing `data-collapse-state="floating"` marker, so a consumer's own CSS wins at normal
specificity. `flex`/`order`/`inline-size` are unaffected and stay inline: `inline-size` in
particular is intentionally live, mirroring the panel's own draggable `sizes` percentage so there's
no visual jump un-floating — a consumer wanting a different floating *width* should set `.sizes`
rather than override the stylesheet rule.
