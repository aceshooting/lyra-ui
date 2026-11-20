---
'@aceshooting/lyra-ui': patch
---

- `lr-video` control-bar selects inherit the component font, and the timeline range is announced once through its value text.
- `lr-image-comparer` exposes its position as the range value text.
- `lr-map` marker popup content is capped to the map height and scrolls; image export attribution strips use the map surface, text color and font.
- `lr-map-anchor` owns its development warning timer and cancels it on disconnect.
- `lr-file-input` remove buttons ignore a row whose file was replaced after render, and turning `multiple` off emits the value events for the retained file.
- `lr-image-viewer` skips a highlight record with a missing anchor or a throwing getter instead of failing to render.
