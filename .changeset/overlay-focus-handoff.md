---
'@aceshooting/lyra-ui': patch
---

Closing the topmost non-modal overlay without focus restoration (for example a hover-closed tooltip or popover) no longer moves focus into the overlay beneath it unless focus was inside the overlay that closed. A focus-trapping overlay beneath, such as a modal dialog, still takes focus back.
