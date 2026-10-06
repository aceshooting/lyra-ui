---
"@aceshooting/lyra-ui": major
---
lr-pan-zoom, lr-zoomable-frame and lr-map: a host `aria-label` now names the element that owns the role (the focusable viewport, the iframe title and the map canvas) instead of staying on the host; an empty `accessibleLabel` property falls back to the localized name. Remove the host `aria-label` if you relied on the localized purpose name there.
