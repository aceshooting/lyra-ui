---
"@aceshooting/lyra-ui": minor
---

Focus repair and density parity for `<lr-activity-feed>`, plus an opt-in focus entry point and
Escape handling for `<lr-confirm-bar>`.

- `<lr-activity-feed>`: focus is now repaired instead of silently dropping to `<body>` when the
  control holding it disappears. Collapsing (`expanded` becoming `false`) moves focus already
  inside the body to `[part="header"]` before the body is hidden; removing the specific `entries`
  row that held focus does the same once that render (and, while virtualized, the internal
  `<lr-virtual-list>`'s own follow-up render) has settled. Neither case touches focus that's
  elsewhere — appending a live entry never steals focus from an unrelated, still-present control.
  The component also gains the `compact`/`frame` density vocabulary its agent-surface siblings
  (`<lr-confirm-bar>`, `<lr-thinking-panel>`) already expose: `compact` tightens header and
  entry-row padding via `--lr-activity-feed-compact-header-padding`,
  `--lr-activity-feed-compact-header-gap`, and `--lr-activity-feed-compact-entry-padding`;
  `frame="plain"` removes the outer card border, background, and corner radius. Both default to
  the existing byte-identical presentation when unset.
- `<lr-confirm-bar>`: gains an opt-in `autofocus` boolean that moves focus into the bar after its
  own first render — the Deny control when it's present and enabled, else `[part="status"]` —
  useful for a host that swaps a focused control out for this bar (the case the class doc already
  described but left entirely to the host, as `<lr-memory-panel>`'s own
  `focusPendingConfirmation()` still does). Also gains an opt-in `escape-denies` boolean that maps
  Escape on `[part="base"]` to the same outcome as clicking Deny, scoped to this element's own
  base rather than `document` since this bar is inline and non-modal, not a member of the shared
  `activateOverlay()` Escape/stacking contract real overlays use. Both default to `false`; neither
  changes any existing behavior unless a host opts in.
