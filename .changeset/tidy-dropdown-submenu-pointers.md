---
'@aceshooting/lyra-ui': patch
---

Fix nested dropdown submenus that were visible but could not receive pointer clicks in WebKit. Both direct submenu items and nested menus now remain interactive outside the parent popup, with or without hoisting and in LTR/RTL. Long dropdowns scroll their inner menu list within the popup's height limit while keeping menu headers and footers visible.
