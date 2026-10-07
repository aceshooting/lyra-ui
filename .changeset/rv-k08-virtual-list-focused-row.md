---
"@aceshooting/lyra-ui": patch
---
lr-virtual-list: the row holding keyboard focus stays mounted outside the window until focus leaves it, so scrolling with the keyboard no longer drops focus to `<body>`.
