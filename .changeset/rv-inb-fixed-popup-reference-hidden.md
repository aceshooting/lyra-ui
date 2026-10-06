---
"@aceshooting/lyra-ui": patch
---
Popups placed with the fixed strategy (`lr-combobox`, `lr-date-input`, `lr-time-input`, menus, previews, and opted-in selects, tooltips and popovers) now hide while their trigger is scrolled out of an inner scroll container, instead of floating detached over unrelated content, and reappear when it scrolls back.
