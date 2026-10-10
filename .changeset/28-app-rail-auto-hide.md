---
"@aceshooting/lyra-ui": minor
---

Add an opt-in `auto-hide` ("peek") mode to `<lr-app-rail>`. The desktop rail rests as the icon-only strip, expands to the full rail as an overlay (the strip's footprint stays in the layout, so the content never reflows) while a moving non-touch pointer or keyboard focus is inside, and docks at full width only when the user pins it with the new `[part="pin-button"]`. Tune it with `peek-open-delay` and `peek-close-delay`; observe it through the read-only reflected `peeking` state and the new `lr-peek-change` event. Escape closes the peek. The pin writes `preferredMode`, so it persists through `storage-key` with `persist="preferred-mode"`. New `appRailPin`/`appRailUnpin` strings ship in every locale catalog. Without `auto-hide` the rail behaves exactly as before.
