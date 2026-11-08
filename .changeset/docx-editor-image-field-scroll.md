---
"@aceshooting/lyra-docs": patch
---

`<lr-docx-editor>` keeps a keyboard-focused image dialog field inside the dialog's scroll area in Firefox. Firefox can scroll the dialog again after focus has landed, toward a tall field such as the image description, which left the focused control outside the visible area; the editor now re-aligns it when that scroll arrives shortly after focus, without moving the page or the document viewport.
