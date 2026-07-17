---
"@aceshooting/lyra-ui": minor
---

Adds `<lyra-thread-list>`: the conversation sidebar — a grouped ("Pinned / Today / Yesterday / Previous
7 days / …"), searchable list of chat sessions built on `lyra-conversation-item` and virtualized via
`lyra-virtual-list`. Data mode (`threads` array) renders rows with optional pin/archive/delete row
actions, all controlled events (`lyra-thread-pin`/`-archive`/`-delete`/`-rename`) carrying the
*requested* new state — no CRUD or persistence of its own. Slotted mode (host-supplied
`lyra-conversation-item`s) skips grouping/virtualization/row-actions entirely, for a host that wants
full control over a short, unconstrained list.
