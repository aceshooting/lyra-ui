---
"@aceshooting/lyra-ui": minor
---

`lyra-graph` gains `GraphNode.communityId` and a `communities` property, rendering one translucent
convex-hull blob per entry (membership = union of `memberIds` and matching `communityId`) behind
links/nodes. Hulls are keyboard/click-activatable (`lyra-community-click`), join the roving focus
ring after nodes and links, and are included in `fit()`'s bounding-box calculation. Fully additive
— an empty `communities` array (the default) renders no hulls and leaves the roving ring/`fit()`
behavior unchanged.
