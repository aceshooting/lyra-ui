---
'@aceshooting/lyra-ui': patch
---

Pressing Tab on a control that has an open keyboard-focus `lr-tooltip` (or an open `lr-popover`) inside an `lr-dialog` or `lr-drawer` now moves focus to the next control instead of getting stuck. While such a hint was open, the other controls in the dialog were made inert; they stay interactive now. Focus also no longer jumps back to the first control of the dialog when the tooltip closes as focus moves on.
