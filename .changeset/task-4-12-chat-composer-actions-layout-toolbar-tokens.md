---
"@aceshooting/lyra-ui": minor
---

`<lr-chat-composer>` gains an `actions-layout` attribute, a `toolbar` slot, and three new themeable
custom properties.

`actions-layout="stacked"` (default `"inline"`, today's single flex row) arranges the `start` and
`end` action slots as a compact one-column rail — `start` above `end` — beside a `textarea` that
spans both rows, via a CSS grid on `[part="row"]`. It's for a multi-row composer (a taller
`min-rows`) where stretching the action buttons across the row's full cross-axis height looks
wrong.

The new `toolbar` slot renders inside `[part="base"]`, above the `chips` tray and input row, so
auxiliary controls — a model or provider picker, for example — can sit inside the composer's own
frame and share its `:focus-within` affordance, the same way `chips`/`start`/`end` already do.
Hidden via `[part="toolbar"][hidden]` when empty, matching those existing slots.

`--lr-chat-composer-padding` (default `var(--lr-space-s)`) and `--lr-chat-composer-gap` (default
`var(--lr-space-xs)`) retune `[part="base"]`'s padding and the row gap between its stacked
`toolbar`/`chips`/`row` sections, joining the existing `-background`/`-border-color`/`-radius`
chrome hooks; `frame="plain"` still zeroes the padding as before.

`--lr-chat-composer-focus-shadow` (default `inset 0 calc(-1 * var(--lr-focus-ring-width)) 0 0
var(--lr-focus-ring-color)`) is the `frame="plain"` focus underline painted on
`[part="base"]:focus-within`. Override it to reshape the underline (a different width or color),
or set it to `none` to cede focus chrome entirely to a wrapper you draw and focus-highlight
yourself. A custom property was chosen over a third `frame` value: every other piece of this
card's paint is already a cssprop hook rather than a `frame` variant, and `none` already reads as
"I'll draw my own" without inventing a new literal.

