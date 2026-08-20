---
"@aceshooting/lyra-ui": patch
---

Fixed two defects in `<lr-map>`'s `maxBounds`, reported together because the first was the only
thing hiding the second.

`maxBounds` never reached maplibre-gl when set declaratively. It is `attribute: false`, so a
property binding is the only way to set it, which puts its one and only appearance in `changed` on
the first update — before the component's asynchronous peer import and WebGL initialization have
produced a map. The `updated()` guard `changed.has('maxBounds') && this._map` therefore
short-circuited, and because the property never changed again it was never retried: a documented
property that read back as set, did nothing, permanently, and warned about none of it. It is now
applied from the map-ready path as well, so a declaratively-set box reaches the peer; a later
reassignment still goes through `updated()` as before.

The property's guard also could not run in the case it was written for. It applies the bounds and
then reads the camera back to detect a non-finite zoom — but at the conditions its own warning text
names (sub-1 fractional zooms in wide containers) maplibre-gl 6.x throws synchronously out of
`setMaxBounds()` instead, so the readback line was never reached. With no `try`/`catch` the
exception escaped `updated()` into the consumer's render cycle, degenerating into repeated throws
from the peer's own matrix math on every later `resize`/`setZoom` and a canvas that never painted
again. A throw now routes into the same drop-the-constraint-and-restore-the-camera path the
non-finite-camera branch already used, so the documented worst case — an unconstrained map plus one
dev-mode warning — is now the real worst case.
