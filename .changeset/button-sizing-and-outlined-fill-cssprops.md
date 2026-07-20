---
"@aceshooting/lyra-ui": minor
---

`lr-button`: expose its per-size geometry and its outlined fill as custom properties, so a consumer
no longer needs a `::part(base)` rule to fit a button into a dense toolbar or to tint an outline.

- `--lr-button-padding-block`, `--lr-button-padding-inline` and `--lr-button-font-size` now carry
  each `size` tier's padding/font-size (the `:host` defaults are the `m` tier). Every tier is now
  pure custom-property re-assignment — matching `lr-input`, `lr-select`, `lr-combobox`,
  `lr-segmented` and `lr-date-input` — so overriding one knob retunes the tier instead of fighting
  the stylesheet.
- `--lr-button-min-height` carries the active tier's `min-block-size` floor (it resolves to that
  tier's existing `--lr-button-size-*` token), and the new `--lr-button-height` pins an exact
  height — flooring *and* capping the button, e.g. to match a fixed toolbar row. It is deliberately
  left undeclared by default so each tier's floor still applies when it is unset.
- `--lr-button-outlined-fill` (default `transparent`) tints `appearance="outlined"`. Like
  `--lr-button-quiet-*` it is not swapped per `variant`. Note that the existing hover
  `filter: brightness()` visibly brightens a tinted fill, where a transparent one showed no change.

`appearance="link"` continues to ignore all of these and render as zero-chrome inline text. With
every property unset, all six tiers render byte-identical to before.
