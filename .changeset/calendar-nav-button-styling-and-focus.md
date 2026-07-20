---
"@aceshooting/lyra-ui": patch
---

Fix `lr-calendar`'s previous-month nav button never matching its own styling rule (it rendered with
raw browser button chrome next to a fully themed next button) and add missing `:hover`/`:focus-visible`
treatment to the nav buttons, day-grid cells, and agenda-event buttons.
