---
"@aceshooting/lyra-ui": patch
---

Add missing `:hover` to six agent-tools components (`lr-browser-frame`, `lr-commit-card`,
`lr-terminal`, `lr-test-results`, `lr-compare-panel`, `lr-confirm-bar`) whose interactive buttons
already had `cursor: pointer` and a correct focus-visible ring but no hover affordance for mouse
users.
