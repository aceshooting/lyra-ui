---
"@aceshooting/lyra-ui": patch
---

Hiding the current `lr-stepper` step now moves `active` to the next visible step (or the previous one when none follows) and fires `lr-step-change`, matching `lr-tab-group`. In a tab group with an overflow menu, the More button returns the tab stop to the selected tab once focus leaves the strip.
