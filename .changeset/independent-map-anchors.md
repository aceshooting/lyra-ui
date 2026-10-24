---
'@aceshooting/lyra-ui': minor
---

Add the experimental `<lr-map-anchor>` element for several independently owned panels on one `lr-map`. Each anchor holds your own live content, which is never cloned or moved, so its listeners and component state survive camera moves, off-screen hiding, style replacement and map reconnects. Each module opens, moves and closes its own anchor with `open`, `lngLat`, `close()` and a cancelable `lr-close-request` followed by `lr-close`, without affecting other anchors or the map's `anchor` slot.

- Anchors are placed like the `anchor` slot and follow the camera. They take their own `safeArea` and `boundary`, or the map's `anchorSafeArea` and `anchorBoundary` while those are unset, and stay placed through a `mapStyle` replacement.
- A `closable` anchor gets a localized close button and closes on Escape. Escape closes the anchor that contains focus first, otherwise the frontmost one. Overlapping anchors are painted with the most recently opened, focused or pressed one in front.
- Focus moves only to `[autofocus]` content or through `focusContent()`, and returns to where it came from when a focused anchor hides, closes or is removed.
- `lr-map` gains an `anchors` slot, where a direct child anchor assigns itself. Import `@aceshooting/lyra-ui/components/lr-map-anchor.js` alongside `lr-map.js`; maps without child anchors render, load and behave as before, and the placement code is still loaded only when an anchor opens.
