---
"@aceshooting/lyra-ui": patch
---

Fix `<lr-split>` and `<lr-stepper>` reporting a stale `effectiveOrientation` (and
`data-effective-orientation`) when `orientation-breakpoint-basis="viewport"` and the viewport
crossed the breakpoint while the element was detached from the DOM. The media-query listener is
torn down on disconnect and a plain reconnect schedules no Lit update, so the missed crossing was
never noticed; reconnecting now re-reads the query and announces the crossing (including
`lr-split-orientation-change` / `lr-stepper-orientation-change`) only when the matched state
actually differs. A plain mount, and a reconnect that crossed nothing, stay silent as before.
