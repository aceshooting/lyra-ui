---
'@aceshooting/lyra-ui': patch
---

Fixed `lr-emoji-picker`'s built-in emoji dataset to load the `emoji-picker-element-data` locale matching the page's locale (falling back to English, and reloading on a later locale change), so emoji accessible names and search now match the page language instead of always being English. Also anchored the search/command clear-button glyph in `lr-emoji-picker` and `lr-command-palette` to the inherited font size instead of the browser's undersized default button font.
