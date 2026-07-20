---
"@aceshooting/lyra-ui": patch
---

Fix `lr-date-picker`'s previous/next month-nav buttons having a hover state but no focus-visible ring
-- the file's only focus-visible coverage was on day cells, leaving keyboard users with no visible
indicator on the nav buttons.
