---
"@aceshooting/lyra-ui": patch
---

Fix `lr-switch`'s thumb miscentering when a consumer styles the `track` part with a `border`.
`box-sizing: border-box` (the library-wide default) let an added border eat into the padding box
the thumb is absolutely positioned against, while the thumb's own size/travel math stayed derived
from the track's declared (border-box) dimensions -- breaking symmetric clearance on the far edge
in both the unchecked and checked states. The track part now uses `box-sizing: content-box`, so an
added border grows the track's outer footprint instead of shrinking the space the thumb positions
within, keeping clearance symmetric regardless of border width.
