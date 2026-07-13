---
"@aceshooting/lyra-ui": patch
---

Fix `lyra-tabs`'s `tablist` part showing a phantom vertical scrollbar on a tablist with no
vertically-overflowing content — `overflow-x: auto` alone can leave the y axis's computed overflow
at `auto` too per the CSS overflow spec, which sub-pixel rounding can trip; `overflow-y: hidden` is
now explicit, since the tablist is never meant to scroll vertically.
