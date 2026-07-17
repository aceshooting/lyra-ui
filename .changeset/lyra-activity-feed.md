---
"@aceshooting/lyra-ui": minor
---

Adds `<lyra-activity-feed>`: an append-only streaming log of granular agent actions, collapsing to
a localized "Completed N steps" summary once the run is over. Implements the shared follow
(stick-to-bottom) contract (`follow` property, `lyra-follow-change` event) and virtualizes its body
through an internal `<lyra-virtual-list>` at/above `virtualizeThreshold` entries, using that
component's `scrollToIndex()` method to drive its stick-to-bottom follow. `<lyra-virtual-list>`
also gains `aria-label` forwarding from the host element onto its internal `role="list"`
container, usable independently of `<lyra-activity-feed>`.
