---
"@aceshooting/lyra-ui": patch
---

`lr-emoji-picker` now resolves its three geometry custom properties to real pixels before using
them for the windowed layout. `--lr-emoji-picker-item-size`, `--lr-emoji-picker-gap`, and
`--lr-emoji-picker-row-height` were read with `parseFloat(getComputedStyle(host).getPropertyValue(
token))`, which hands back the property's computed *token stream* rather than a length: the shipped
`2.5rem` item size was used as `2.5px`, the `0.125rem` gap as `0.125px`, and the `calc()`-based
default row height was unparseable and always fell back to a hardcoded `64`. The windowed grid
therefore packed its column cap of 20 emoji into a row that could only paint five, and scrolled at a
row pitch that did not match the painted rows.

Each token is now assigned to an off-flow probe box in the shadow root and read back as that box's
used inline size, so the browser performs the unit math — `rem`, `em`, `ch`, `%`, `calc()`, any CSS
length resolves correctly, and the item-size probe carries the same `--lr-icon-button-size` minimum
the emoji buttons do, so the measured item size is the painted one. The result is cached and
re-derived only when it can actually change: the probe boxes are themselves observed, so a token
override applied after the first render, a theme swap, or a root/host font-size change updates the
geometry without any per-frame measurement. Numeric fallbacks still cover the case where no box has
been laid out yet.

Consumers no longer have to express these tokens in `px` for the windowed geometry to line up with
what is painted.
