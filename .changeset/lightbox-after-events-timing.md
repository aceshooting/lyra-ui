---
'@aceshooting/lyra-ui': major
---

`lr-lightbox`: `lr-after-show` and `lr-after-hide` now fire once the open or close animation has
finished, as on the other overlays, instead of straight after the render. Under
`prefers-reduced-motion` or a zero `--show-duration`/`--hide-duration` they still follow the render
directly. `show()`, `hide()` and `close()` resolve with the after-events, and a transition
interrupted by the opposite one emits no after-event of its own. Migration: code that relied on
`lr-after-hide` arriving while the surface was still fading (`data-closing` set) should listen for
`lr-close` instead; code that waited for the motion separately can rely on the after-events.
