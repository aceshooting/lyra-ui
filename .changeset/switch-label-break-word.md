---
"@aceshooting/lyra-ui": patch
---

Fix `<lr-switch>`'s label/hint/error text breaking mid-syllable, and possibly wrapping, well
before it runs out of room.

The shared `[part="form-control"], [part="label"], [part~="hint"], [part="error"]` rule used
`overflow-wrap: anywhere`, which -- unlike `overflow-wrap: break-word` -- also collapses the
element's min-content contribution to essentially a single character. Combined with the same
rule's `min-inline-size: 0`, an ordinary short label could be squeezed far below its longest
word's width and forced to split it mid-syllable, even when there was ample room to sit on one
line or wrap cleanly at a space.

Switching to `overflow-wrap: break-word` alone regressed the pre-existing 320px unbreakable-token
test: without a width propagated down to it, `.switch-layout` (an `inline-flex` box with no
explicit size) falls back to shrink-to-fit sizing, which can never size narrower than its own
min-content -- and `break-word` (correctly) keeps that min-content at the token's full width, so
the layout overflowed its ancestor instead of shrinking into it. Adding `max-inline-size: 100%` to
both `:host` and `.switch-layout` propagates an ancestor's real constraint all the way down to the
flex layout, fixing the overflow. `min-inline-size: 0` was deliberately *not* added to either of
those two rules: leaving their automatic minimum size content-based means an outer flex/grid
ancestor (e.g. a settings-panel row with another sibling control) won't disproportionately squeeze
the switch below its longest word's width the way `overflow-wrap: anywhere`'s near-zero min-content
let it -- at the cost of the row overflowing slightly rather than breaking a word, which is the
tradeoff `break-word` intends.
