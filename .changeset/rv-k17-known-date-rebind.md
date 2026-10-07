---
"@aceshooting/lyra-ui": major
---
lr-known-date: assigning the same `parts` object again, or one with the current field text, is now ignored, and assigning the date the control already holds keeps the typed field text and the pending `change`, so a re-rendering parent no longer erases typing or turns "03" into "3". Migration: to reset the fields, assign a new `parts` object with different text or a different `value`.
