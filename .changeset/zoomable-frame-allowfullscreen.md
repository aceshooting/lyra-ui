---
'@aceshooting/lyra-ui': patch
---

`lr-zoomable-frame` no longer sets the native `allowfullscreen` attribute when its `allow` value already carries a `fullscreen` directive, so the browser stops warning that one overrides the other.
