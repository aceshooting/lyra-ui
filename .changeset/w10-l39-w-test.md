---
'@aceshooting/lyra-ui': patch
---

- Component tests now assert rendered CSS (computed styles under real hover and keyboard focus) instead of matching stylesheet source text.
- Timer-driven tests read the pending-timer list or wait on the observable condition instead of sleeping fixed real time.
- Chart, map, timeline and flow-minimap tests land focus and hover through the shared keyboard and pointer helpers.
