---
"@aceshooting/lyra-ui": minor
---

Add the public `--lr-theme-surface-glass-dark-share` theme input (a percentage, default `10%`) for how much of the theme surface dark Glass chrome keeps in its deepening anchor. Apps that lift their dark surface tokens to a softer grey can raise it, on `:root` or on a container, to get lighter glass without private overrides. The default paints identically. The input is not registered with `@property` (a registered inherited property slows every re-theme in Chromium), so a value that is not a percentage voids the dark fill; the development build warns about one set on `:root`. Raising it trades text contrast over bright backdrops, as documented in the styles and tokens guide.
