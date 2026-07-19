---
"@aceshooting/lyra-ui": patch
---

`<lr-code-editor>`: make `--lr-code-editor-tab-size` actually themeable.

The stylesheet read the token on the `textarea` part, but `render()` also wrote an inline
`tab-size:${tabSize}` on that same element on every update, and an inline declaration always beats a
rule — so the documented token was inert and a host-level override was silently ignored.

`render()` now writes the token itself, and only when `tabSize` was explicitly assigned. The
resulting precedence, highest first: an explicitly set `tabSize` (property or `tab-size` attribute)
> a host-level `--lr-code-editor-tab-size` > the `:host` default of `2`. `tabSize` therefore remains
the primary knob and still wins wherever it is used; it just stops shadowing the token while it sits
at its default. The Tab key follows the same order, so the indent unit and the rendered tab stops
cannot disagree — except for a length-valued token (`40px`, `2ch`, …), which stays a purely visual
tab-stop metric and leaves the inserted-space count at `tabSize`.
