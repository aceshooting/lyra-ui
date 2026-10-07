---
"@aceshooting/lyra-ui": patch
---
lr-poll-status and lr-random-content: the refresh glyph is drawn inline instead of registering `<lr-icon>`, which removes the icon implementation from the bundle of each entry; a glyph themed through `registerIconLibrary('default')` no longer reaches these two buttons.
