---
"@aceshooting/lyra-ui": major
---
`lr-input`: the password visibility toggle no longer carries `aria-pressed` (its name already flips between "Show password" and "Hide password", so "Hide password, pressed" read as the opposite state); migration: read `passwordVisible` instead of the button's `aria-pressed`.
