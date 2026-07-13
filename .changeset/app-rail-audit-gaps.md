---
"@aceshooting/lyra-ui": minor
---

`lyra-app-rail`: add a `resizable` opt-in (drag + keyboard-steppable `[part="resizer"]` handle,
`railWidthPx`/`minRailWidthPx`/`maxRailWidthPx`, `lyra-rail-resize` event) for the `'full'` state's
width; add `preferredMode` to manually prefer `'full'`/`'icon-only'` while the mobile breakpoint
keeps tracking automatically; and fix the mobile toggle button's `aria-label` to use a proper
`openNavigation` message key (consistent with the existing `closeNavigation` key) instead of
concatenating a hardcoded `" navigation"` suffix onto a partially-localized string.
