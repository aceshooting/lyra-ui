---
"@aceshooting/lyra-gen": minor
---

Catalog components can declare a trusted `eventPayload(event)` adapter that derives an action payload from the event that initiated it; the result is validated against the action schema, and a throw denies the action. The `mcp-app` role uses it so an embedded app's own tool name and arguments reach the host's authorization instead of the node's static payload.
