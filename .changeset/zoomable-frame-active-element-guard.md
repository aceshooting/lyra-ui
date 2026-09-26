---
"@aceshooting/lyra-ui": patch
---

`<lr-zoomable-frame>` now routes its `focus()`/`blur()` overrides and its internal frame-focus tracking through the shared `activeElementIn()` guard instead of reading `ShadowRoot.activeElement`/`Document.activeElement` directly. It was missed by the earlier sweep (`fix(a11y): guard every ShadowRoot.activeElement read`) that moved every other focus-rehoming site in the library onto that helper, so it could still throw an unhandled error under a DOM whose `activeElement` getter itself throws (e.g. happy-dom 20.11.1) when nothing is focused. Real browsers never take the guarded path, so behavior there is unchanged.
