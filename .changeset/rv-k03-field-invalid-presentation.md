---
"@aceshooting/lyra-ui": major
---
`lr-time-input` and `lr-phone-input` no longer render `validationMessage` automatically, `lr-phone-input`/`lr-otp-input` drop the default danger border and host `aria-invalid`, and every text/date field sets `data-invalid` when invalid after interaction. Migration: pass your own `error-text`, and style `:state(user-invalid)` or the invalid-border tokens for a danger edge.
