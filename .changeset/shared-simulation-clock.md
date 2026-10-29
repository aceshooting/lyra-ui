---
'@aceshooting/lyra-ui': minor
---

Add a shared epoch-time simulation clock, immutable irregular sample mapping and an opt-in sequence playback binding. Maps, charts and detail panels can consume one selected instant while existing standalone index playback stays unchanged. Bindings release without pausing other consumers, and live/replay presentation remains separate from time-zone formatting.

The shared time helpers add 6,058 gzip bytes to the root entry. Granular entry points remain available, and the helpers do not load sequence components or optional engines.
