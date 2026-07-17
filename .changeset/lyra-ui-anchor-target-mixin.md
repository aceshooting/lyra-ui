---
"@aceshooting/lyra-ui": minor
---

Adds the `DocumentAnchorTarget` mixin (`internal/anchor-target.ts`) and its `LyraAnchorTarget`
interface: the shared implementation of the anchor-target contract every anchor-capable lyra-ui
viewer adopts — `highlights`/`activeHighlightId`/`anchor` properties, `scrollToAnchor()` with a
generation-guarded retry-until-loaded loop and screen-reader announcements, and
`lyra-highlight-activate`/`lyra-text-select`/`lyra-anchor-result` event plumbing including
selection->anchor emission. Internal module; no adopter yet in this release (`lyra-pdf-viewer` adopts
it next). No behavior change for any existing component.
