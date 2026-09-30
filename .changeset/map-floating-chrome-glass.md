---
'@aceshooting/lyra-ui': patch
---

Apply the shared Glass treatment to map navigation, scale, attribution and legends. Solid and
accessibility preferences retain opaque surfaces, and scrolling legends keep their material
stationary without changing native peer controls or map data colors.

Defer resize-observer control measurements to the next animation frame so adjusting a legend's
available space cannot interrupt the same resize notification cycle. Cancel pending measurements
when the map disconnects or changes containers.
