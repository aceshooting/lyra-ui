---
'@aceshooting/lyra-ui': minor
---

`lr-chat-viewport`: add the `--lr-chat-viewport-padding`, `--lr-chat-viewport-gap` and
`--lr-chat-viewport-content-max-inline-size` custom properties (a narrower transcript column is
centred), and a `live-settle` announce-when-settled mode that announces a streamed message once,
with its final text, after it stops changing. In slotted mode the transcript wrapper is now a flex
column, so adjacent message margins no longer collapse, and the unread divider is centred in the
space above the first unread message. The documentation now states the host's flex-column layout
contract: do not override its `display`, and give it a bounded block size.
