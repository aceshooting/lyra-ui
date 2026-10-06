---
"@aceshooting/lyra-ui": major
---
`lr-phone-input` and `lr-otp-input` render label/hint/error text and the matching slot together (text first), describe error before hint, and accept `with-label`/`with-hint`. Migration: if you set both the text and the slot, keep only one.
