---
"@aceshooting/lyra-ui": minor
---

Add the public `--lr-theme-surface-glass-dark-share` theme input (a percentage, default `10%`) for how much of the theme surface dark Glass chrome keeps in its deepening anchor. Apps that lift their dark surface tokens to a softer grey can raise it, on `:root` or on a container, to get lighter glass without private overrides. The default paints identically; invalid values fall back to `10%`. Raising it trades text contrast over bright backdrops, as documented in the styles and tokens guide.
