---
"@aceshooting/lyra-ui": patch
---

Fix `lr-details`' summary -- the component's real, natively-focusable/clickable surface -- having no
hover or focus-visible treatment at all. `lr-accordion-item` (which extends `lr-details` with no
style override) is fixed by the same change.
