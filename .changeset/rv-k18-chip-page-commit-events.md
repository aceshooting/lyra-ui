---
"@aceshooting/lyra-ui": minor
---
lr-chip and lr-page now fire a non-cancelable post-commit event after an accepted request: `lr-chip-change { value, selected }` after `lr-chip-toggle-request`, and `lr-nav-open-change { open }` after `lr-nav-toggle-request`.
