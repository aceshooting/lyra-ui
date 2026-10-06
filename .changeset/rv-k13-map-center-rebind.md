---
"@aceshooting/lyra-ui": major
---
lr-map: re-assigning the identical `center` array no longer snaps the camera back after a user gesture or `fitBounds()` (a parent re-render, or `lr-geojson-viewer` re-rendering). To re-centre on the same coordinates, assign a new array (for example `map.center = [...home]`).
