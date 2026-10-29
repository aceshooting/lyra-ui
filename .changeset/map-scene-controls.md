---
"@aceshooting/lyra-ui": minor
---

Add opt-in component-owned globe and terrain toggles to `lr-map.controls`. The controls update typed scene properties before emitting request-change events, preserve controlled application assignments, and expose localized pressed, busy and unavailable states. Terrain enablement requires an explicit existing elevation source.

Map scene ownership, controls and camera session support add 4,910 gzip bytes to the media barrel and 5,193 to viewers. Optional engines remain dynamically loaded.
