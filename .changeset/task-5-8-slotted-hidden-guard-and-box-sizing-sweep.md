---
"@aceshooting/lyra-ui": patch
---

Sweep of the `::slotted()`-driven `[hidden]` guard and `::slotted(*)` `box-sizing` shapes that
`<lr-multi-split>`'s "floating" panel already carries, across every other component with the same
shapes:

- Fixed: `<lr-card>`'s `[part~="media"] ::slotted(*)` allocates a definite `inline-size: 100%` to
  the slotted media child but never declared `box-sizing: border-box`. Because `box-sizing` does
  not inherit across the slot boundary, a padded or bordered media child (an `<img>` wrapper, a
  custom placeholder, etc.) silently overflowed the media frame by its own padding and border
  instead of filling it exactly, the same defect already fixed for `<lr-multi-split>`,
  `<lr-carousel>`, `<lr-dashboard-grid>`, and `<lr-timeline>`.
- Reviewed, not changed: `<lr-video-playlist>`'s slotted `<lr-video>` children are toggled via
  `video.hidden`, matching the shape that needed a `::slotted([hidden])` restatement elsewhere —
  but every `lr-*` element already carries its own `:host([hidden]) { display: none !important }`
  from the shared base stylesheet, so an outside `display` rule (however specific) cannot re-show
  it; adding a redundant `::slotted([hidden])` rule here would do nothing.
- Reviewed, not changed: `<lr-split-panel>` and `<lr-page>`'s `::slotted(*)` rules only cap an
  otherwise-`auto` width with `max-inline-size: 100%`, never a definite `inline-size`/flex-basis
  allocation. A block-level slotted child's `width: auto` already resolves to exactly fill its
  container regardless of `box-sizing`, so no padding/border overflow is possible there; confirmed
  with a padded/bordered slotted child in both components before deciding not to add a no-op
  declaration. The same reasoning excludes the remaining `::slotted(*)` rules in the library that
  only set `max-inline-size`/`min-inline-size` (icon/adornment/action-row slots in
  `<lr-badge>`, `<lr-chip>`, `<lr-alert>`, `<lr-callout>`, `<lr-toast-item>`, `<lr-kbd>`,
  `<lr-spinner>`, `<lr-dialog>`, `<lr-tool-approval-dialog>`, `<lr-tool-select-dialog>`,
  `<lr-agent-workspace>`, `<lr-flow-run-status>`, `<lr-input>`, `<lr-time-input>`,
  `<lr-menu-item>`, and others) — none allocate a definite size to the slotted node, so
  `box-sizing` cannot change their rendered result.
