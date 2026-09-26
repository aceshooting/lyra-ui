---
"@aceshooting/lyra-ui": patch
---

`lr-menu-item` now shows its `details` part for any assigned element, so a shadow-rendered `<lr-kbd slot="details" keys="mod+t">` shortcut chip is visible. An empty placeholder element in `details` now reserves one gap. Whitespace-only text and empty forwarding slots remain hidden.
