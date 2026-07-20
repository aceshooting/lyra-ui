---
"@aceshooting/lyra-ui": patch
---

Fix `lr-pagination`'s page-input and `lr-tool-param-form`'s numeric JSON-schema fields rendering the
native spin-button inside a fixed-size control box -- the adjacent prev/next buttons (pagination) and
form validation (tool-param-form) already provide stepping, so removing the spinner loses no
functionality.
