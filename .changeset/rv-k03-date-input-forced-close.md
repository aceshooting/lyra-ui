---
"@aceshooting/lyra-ui": patch
---
`lr-date-input` closes its calendar on disable, fieldset disable or `readonly` even when an `lr-hide` listener vetoes; that `lr-hide` is non-cancelable.
