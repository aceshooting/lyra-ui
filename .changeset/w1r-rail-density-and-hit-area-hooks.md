---
"@aceshooting/lyra-ui": minor
---

`<lr-app-rail-item>`/`<lr-app-rail>`: four remaining density hooks from the item geometry/
current-indicator work, all byte-identical when unset.

- **New on `<lr-app-rail-item>`:** `--lr-app-rail-item-font-size` retunes `[part="base"]`'s font
  size independently of family/weight/line-height (declared after the `font` shorthand, mirroring
  `<lr-button>`'s own `--lr-button-font-size`).
- **New on `<lr-app-rail-item>`:** `--lr-app-rail-item-current-font-weight` retunes the
  `current`/`aria-current="page"` item's font weight independently of the shared
  `--lr-font-weight-semibold` token, mirroring `<lr-stepper>`'s
  `--lr-stepper-current-font-weight` and `<lr-segmented>`'s `--lr-segmented-selected-font-weight`.
- **Fix:** in `icon-only` presentation, `[part="base"]` now resolves to a square hit target
  matching the icon-button footprint used elsewhere in this library, instead of stretching across
  the rail's icon column.
- **New on `<lr-app-rail>`:** `--lr-app-rail-header-min-block-size` reserves a minimum height for
  `[part="header"]`, for content that mounts or resizes asynchronously (e.g. an avatar image).
- **Fix on `<lr-app-rail-group>`:** its own `collapsible` `[part="toggle"]` had the identical
  stretch-instead-of-square defect in `icon-only` presentation; it now resolves to the same square
  hit target as `<lr-app-rail-item>`'s.
