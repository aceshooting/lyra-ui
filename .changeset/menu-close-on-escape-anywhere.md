---
"@aceshooting/lyra-ui": minor
---

`<lyra-menu>` gains an opt-in `closeOnEscapeAnywhere` property. Escape has always closed the menu
and refocused the trigger when it originates from a real `<lyra-menu-item>`, but slotted non-item
content (e.g. a form control slotted alongside the items) previously got full default keyboard
behavior with no way to close the menu on Escape. Setting `closeOnEscapeAnywhere` extends that
same Escape-closes-and-refocuses behavior to keydowns from anywhere in the list, including slotted
non-item content. Defaults to `false`, so existing consumers are unaffected.
