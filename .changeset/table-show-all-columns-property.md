---
"@aceshooting/lyra-ui": minor
---

`lyra-table` gains a public, reflected `showAllColumns` property/`show-all-columns` attribute for its reveal-hidden-columns state, plus a `lyra-columns-revealed` event fired when `[part='reveal-columns-button']` toggles it. Consumers can now read the current reveal state back (to persist it) and set an initial one (to restore a previously-persisted preference), mirroring the read-back/set-forward contract `sortKey`/`sortDir` already support. The button still toggles the state itself by default, so existing usage is unaffected.
