---
"@aceshooting/lyra-ui": minor
---

`lyra-heatmap`'s color ramp now preserves a translucent `rgba()`/`hsla()`/hex-with-alpha color instead of silently resolving it to fully opaque. `resolveRgb()`/`hexToRgb()` return an `[r, g, b, a]` quadruple (previously `[r, g, b]`), and the ramp emits `rgba(...)` whenever an endpoint is translucent — unchanged `rgb(...)` output for opaque colors, so an existing consumer using only opaque `--lyra-heatmap-scale-lo`/`-hi` values sees no difference. Lets a consumer key a ramp endpoint off a themed semi-transparent surface token (e.g. a "quiet baseline" tint) and get the intended translucent cell color instead of a stark opaque one.
