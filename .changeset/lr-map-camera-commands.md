---
'@aceshooting/lyra-ui': major
---

`lr-map` gains camera commands and compares `center` by value.

- **Breaking:** assigning a new `center` array with the same coordinates is now a no-op instead of re-centring the map over the user's pan. Call `jumpTo()` to re-centre explicitly.
- `flyTo()`, `easeTo()` and `jumpTo()` honor reduced motion, queue until the engine exists and write the resulting camera back to `center` and `zoom`.
- `lr-map-view-change` reports programmatic moves with `source: 'command'` and the visible `bounds`.
- `cameraPadding` applies persistent camera padding, also used when fitting.
- `fitToData()` frames markers, data layers and the choropleth; `fitBounds()` and camera commands no longer get interrupted by a same-tick `center` or `zoom` update.
- `project()`, `unproject()` and a frame-throttled `lr-map-move` event.
