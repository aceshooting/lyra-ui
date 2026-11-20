---
'@aceshooting/lyra-ui': major
---

- **Breaking:** `lr-map` vertex editing now moves a focused vertex in screen direction under RTL as well. ArrowLeft moves it left and ArrowRight moves it right in both directions, because the map canvas is never mirrored. Migration: if you documented or tested mirrored arrow keys for RTL map editing, swap ArrowLeft and ArrowRight there. Nothing changes for LTR pages.
- `lr-map` puts the scene panel in the same row layout as the legend and the pick and drawing bars. It no longer covers the bottom corner controls, scale, attribution or legend. When collapsed, the panel is only as wide as its content instead of spanning the map.
- `lr-video` keeps a panorama view in the picture row when narrow controls move below the video, so the controls no longer overlap it.
- `lr-av-player` with `controls-surface="clear"` gives the playback-rate select visible hover and pressed fills that differ from each other. It also honours `--lr-av-player-rate-select-hover-bg` and `--lr-av-player-rate-select-active-bg`.
- `lr-animated-image` starts playing on the first press of its play button when `play` is set but reduced motion is holding the image frozen.
- `lr-flag`, `lr-map` and `lr-lightbox` class modules no longer import composed-child class modules that do nothing on import.
- Default-string slices now resolve a key read from a typed state field, so `lr-qr-code` no longer ships unused default strings.
- The optional-peer reference now names the opt-in `lr-flag` resolver entries that load `@aceshooting/lyra-flags`.
