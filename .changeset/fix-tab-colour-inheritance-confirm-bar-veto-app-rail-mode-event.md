---
"@aceshooting/lyra-ui": minor
---

Three bug fixes across `<lr-tab>`, `<lr-confirm-bar>`, and `<lr-app-rail>`.

- `<lr-tab>`: the projected tab descriptor's own host declared no `color`/`font`, so it inherited
  the library's base default text color instead of the real `[part="tab"]` button's computed
  color. In practice, `--lr-tab-group-selected-color` and `--lr-tab-group-hover-color` never
  visibly reached a tab's label text, even though they correctly recolored `[part="tab"]` itself.
  `<lr-tab>`'s host is now `color: inherit; font: inherit;` alongside its existing
  `display: contents`, so the projected label picks up the button's real computed color and font.
- `<lr-confirm-bar>`: `decide()` dispatched the cancelable `lr-approve`/`lr-deny` event
  synchronously, then unconditionally overwrote `.pending` with its own built-in value — silently
  clobbering a synchronous listener that had called `preventDefault()` and then resolved the
  decision itself (by setting `.decision` or `.pending` directly) instead of waiting for the
  built-in pending/loading presentation. That listener's own state now wins: the built-in
  `pending` fallback only applies when the listener left both `.decision` and `.pending`
  untouched. Also adds a new reflected `disabled` boolean property that disables both Deny and
  Approve and makes `decide()` a no-op, independent of and composable with `pending`.
- `<lr-app-rail>`: a `preferred-mode` restored from `localStorage` on mount (`storage-key` +
  `persist="preferred-mode"`) used to write the resolved mode directly, bypassing
  `setEffectiveMode()` — so a consumer syncing app chrome to the rail's mode never learned a
  persisted preference had been restored. Restoration now fires `lr-mode-change` too, deferred to
  the first `updated()` (after that mount's render and attribute reflection have already landed)
  so the event never precedes the DOM state it describes. No event fires for an ordinary mount
  with nothing persisted, or when the restored mode happens to equal the default.
