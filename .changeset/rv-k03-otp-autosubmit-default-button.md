---
"@aceshooting/lyra-ui": major
---
`lr-otp-input`'s `autosubmit` follows Enter-to-submit's implicit-submission rules: it submits through the form's default button, and nothing while that button is disabled. Migration: call `form.requestSubmit()` from an `lr-complete` listener if you need another submitter.
