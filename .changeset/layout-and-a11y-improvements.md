---
"@aceshooting/lyra-ui": minor
---

Assorted layout and accessibility improvements.

- `<lr-split>`'s `defaultSizes` accepts CSS length strings (`['200px', 50]`) alongside percentages,
  resolved against the measured container and renormalized — a fixed-width sidebar no longer needs a
  `firstUpdated()` measure-and-convert dance.
- `<lr-table>` gains typed `accessible-label`/`caption` properties and warns in development when a
  grid ships with no accessible name.
- `<lr-popover>` gains `hide({ focusTrigger })` for explicit focus return on programmatic close.
- `<lr-segmented>` auto-reveals the selection when `value` is set programmatically, and exposes
  `scrollToValue()`.
- `<lr-heatmap>` warns when no 2D canvas context is available instead of silently rendering nothing.
- `<lr-file-input>` shows visible, localized rejection feedback per reason, replacing the sr-only
  count-only message.
- `<lr-tool-result-view>` renderers can signal failure via a reflected `status`.
- `gemstoneGlyph()` defaults its fill to `currentColor` and carries an intrinsic `1em` box.
