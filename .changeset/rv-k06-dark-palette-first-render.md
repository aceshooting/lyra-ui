---
"@aceshooting/lyra-ui": patch
---
lr-markdown, lr-code-block: the light or dark syntax palette is now read on the first render instead of on connect, so an element slotted into a host that has not rendered its slot yet (such as lr-chat-message) no longer keeps the light palette on a dark page.
