---
"@aceshooting/lyra-ui": patch
---

Add missing `:hover` to six components (`lr-stack-trace`, `lr-span-waterfall`, `lr-chat-viewport`,
`lr-checkpoint`, `lr-push-to-talk`, `lr-transcript-feed`) whose interactive controls already had
`cursor: pointer` and a correct focus-visible ring but no hover affordance for mouse users.
