---
"@aceshooting/lyra-ui": patch
---
lr-chat-viewport: registers its wheel and touch listeners as passive so scrolling never waits for the main thread, and treats Shift+Space as a scroll-back gesture that releases `follow`.
