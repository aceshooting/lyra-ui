---
"@aceshooting/lyra-ui": patch
---

Harden `<lr-popup>` against the same imperative/declarative attribute-write desync just fixed in
`<lr-popover>`/`<lr-tooltip>`.

`<lr-popup>` shared the identical pattern (`anchorPositioned` as a plain non-reactive field, an
imperative `toggleAttribute` write alongside a declarative template binding for the same
`data-active`/`data-awaits-position` attributes) but never exhibited the observable bug, because
its `updated()` lifecycle hook unconditionally repositions on every update cycle regardless of
which property changed -- masking any stale-cache skip with a redundant imperative correction on
the same cycle. `anchorPositioned` is now a real reactive `@state()` property here too, removing
the fragile reliance on that masking behavior.
