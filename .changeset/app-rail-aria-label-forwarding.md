---
"@aceshooting/lyra-ui": minor
---

`lyra-app-rail`'s navigation landmark (and its `role="dialog"` while the mobile overlay is open) now honors a host-level `aria-label` attribute, taking precedence over the `label` property and its localized `"Navigation"` default, mirroring `<lyra-date-input>`'s `accessibleLabel` pattern. Previously a host-level `aria-label` on `<lyra-app-rail>` had no effect on the accessible name computed inside its shadow DOM.
