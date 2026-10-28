---
"@aceshooting/lyra-ui": minor
---

Add typed `lr-map` projection and terrain overrides. `projection` selects mercator or globe; `terrain` uses a caller-owned raster elevation source with finite nonnegative exaggeration. Clearing an override restores the current style's captured configuration, including projection expressions. Overrides follow style replacement and participate in map readiness; unsupported or invalid configurations use the localized map fallback. Ordinary maps retain their existing style-driven behavior.

The typed scene controller adds 1,887 gzip bytes to the media barrel and 1,891 bytes to the viewers barrel. Their delivery limits advance only to the next 64-byte boundary; passing bundle limits and optional engine isolation remain unchanged.
