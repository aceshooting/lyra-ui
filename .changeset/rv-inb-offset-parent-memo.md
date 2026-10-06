---
"@aceshooting/lyra-ui": patch
---
Anchored popups resolve each element's positioning context once per placement update instead of once per placement step, reducing style reads while a menu, select or tooltip is open during scrolling.
