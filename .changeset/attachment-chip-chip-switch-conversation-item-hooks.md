---
"@aceshooting/lyra-ui": minor
---

Add themeable CSS custom properties and a layout opt-in across four components, every one
byte-identical when unset:

- `<lr-attachment-chip>`: `--lr-attachment-chip-padding` and `--lr-attachment-chip-compact-padding`
  make `[part="base"]`'s previously-hardcoded padding themeable in both the resting and `compact`
  states; `--lr-attachment-chip-compact-thumbnail-only-padding` gives the lone thumbnail rendered
  by `compact` + `thumbnail-only` its own reduced, symmetric padding instead of keeping the
  padding sized for a text row that no longer renders.
- `<lr-chip>`: a new `wrap` boolean property lets a long `[part="label"]` wrap onto multiple lines
  instead of ellipsis-truncating to one, matching `<lr-suggestion-chips>`'s identical opt-in.
- `<lr-chip-group>`: `--lr-chip-group-gap` makes `[part="base"]`'s wrap gap themeable.
- `<lr-switch>`: `--lr-switch-track-border`, `--lr-switch-checked-thumb-fill`, and
  `--lr-switch-label-color`/`--lr-switch-checked-label-color` add a track border hook and
  independent checked-state thumb/label colors.
- `<lr-conversation-item>`: `--lr-conversation-item-align` lets a consumer opt a reliably
  single-line row into `center` cross-axis alignment (default stays `flex-start`, which remains
  correct for the common multi-line title+excerpt row).
