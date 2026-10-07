---
"@aceshooting/lyra-ui": patch
---

Preserve known-date's public focus notification when moving between its date fields. Internal transitions use a null related target to avoid shadow retargeting suppressing the notification; blur still fires only when leaving the whole control.
