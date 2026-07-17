---
"@aceshooting/lyra-ui": minor
---

`lyra-graph` gains a double-activate expand gesture: double-clicking a node, or activating the same
focused node twice via Enter/Space within 500ms, emits `lyra-node-expand { id }`. A new
`GraphNode.expandable` flag renders a "+" badge and adds "expandable" to the node's spoken text. A
node newly linked to an already-positioned neighbor (e.g. appended after an expand) now spawns near
that neighbor instead of a random position. Fully additive — no existing click/keyboard behavior
changes, and a graph that never sets `expandable` never renders the badge (though the
`lyra-node-expand` event itself fires for any double-activated node, matching native
dblclick semantics).
