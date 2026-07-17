---
"@aceshooting/lyra-ui": minor
---

`lyra-chat-message` gains `actionsOutsideBubble` (reflects to `actions-outside-bubble`): renders the
`actions` slot's content as a sibling immediately after the message bubble instead of nested inside its
footer's own padding/background box. Previously a consumer whose action row (e.g. a hover-reveal copy
button) had to sit visually outside the bubble's chrome could not adopt this component at all, since
`::part(footer)` styling alone cannot detach it from the bubble's box.
