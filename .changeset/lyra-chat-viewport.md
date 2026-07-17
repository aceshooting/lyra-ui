---
"@aceshooting/lyra-ui": minor
---

Adds `<lyra-chat-viewport>`: the transcript scroll container for a chat/agent conversation surface —
owns the stick-to-bottom `follow` state machine (`follow` property, `lyra-follow-change` event,
matching the same shared follow contract `<lyra-activity-feed>` already implements) while an answer
streams, a built-in "jump to latest" pill with a pluralized unread count, and an unread divider. Two
content shapes are auto-detected: ordinary element children (slotted mode) or exactly one
`lyra-virtual-list` (virtual mode, built on that component's `scrollToIndex()` method). Renders no
messages and computes no unread state itself — the host supplies `unreadStartIndex` and slots its
own message elements or a virtual list.
