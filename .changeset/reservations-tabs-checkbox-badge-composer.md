---
'@aceshooting/lyra-ui': minor
---

`reservations.css` (and the adoptable `reservationStyles`) now reserve the upgraded footprint of `lr-tab-group`, `lr-tab`, `lr-tab-panel`, `lr-checkbox`, `lr-badge` and `lr-chat-composer` before their definitions load. A not-yet-upgraded tab group lays out its tabs as one tab-sized row and shows only the panel that will be shown, so prerendered pages using these elements no longer shift when they upgrade.
