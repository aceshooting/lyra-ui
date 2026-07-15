---
"@aceshooting/lyra-ui": patch
---

`lyra-popover`/`lyra-dropdown`/`lyra-tooltip`'s `[part="popup"]` is now `position: fixed` from the start instead of only once the popup is first opened and JS positions it. Previously, while closed, the popup stayed `position: static` sized to its full slotted content, inflating the component's own inline-block host box to match -- an invisible-but-still-hit-testable area that could sit on top of unrelated page content and intercept pointer events until the trigger was first clicked.
