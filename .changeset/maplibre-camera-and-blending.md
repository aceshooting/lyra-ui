---
"@aceshooting/lyra-map": major
"@aceshooting/lyra-ui": patch
---

Update the modular renderer to MapLibre GL JS 6.19.0. Maps can use the new line,
fill and raster blend modes, read their request transform with `getTransformRequest()`,
and supply a Trusted Types policy with `setTrustedTypesPolicy()`. Globe camera math
loads when a style requests the globe or vertical perspective projection.

Update direct gesture-handler construction, custom handler animation results, and calls to
low-level feature query and painter methods as described in the Lyra Map 2.x migration guide.
Sandboxed pages can use modular workers when the server permits cross-origin module requests.
The `lr-map` component supports both Lyra Map 1.x (from 1.5.2) and 2.x.
