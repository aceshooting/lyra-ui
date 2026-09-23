---
'@aceshooting/lyra-ui': patch
---

Fixed `lr-date-input`, `lr-time-input`, and `lr-locale-picker` so their calendar/picker/option popups are fully removed from layout once settled closed, instead of staying present at `visibility: hidden`, so they no longer silently enlarge a scrollable ancestor's scroll area.
