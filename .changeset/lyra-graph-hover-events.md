---
"@aceshooting/lyra-ui": minor
---

`lyra-graph` gains `lyra-node-enter`/`lyra-node-leave`/`lyra-link-enter`/`lyra-link-leave` hover
events (mirroring the existing `lyra-node-click`/`lyra-link-click` detail shapes) plus a `data-hovered`
attribute toggled on the hovered node/link element for pure-CSS theming. Both are suppressed while a
drag or pan gesture is in progress, so a drag crossing over other nodes/links doesn't spam
enter/leave pairs. Previously a consumer computing an adjacency-based neighbor highlight on hover
(e.g. dimming every unconnected node/link) had no way to observe which node/link was currently
hovered from outside the component.
