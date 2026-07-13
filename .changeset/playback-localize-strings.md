---
"@aceshooting/lyra-ui": minor
---

`lyra-playback`'s play/pause button and position-slider `aria-label`s ("Play"/"Pause",
"Playback position") now route through `this.localize()`, overridable via
`.strings`/`registerLyraLocale()`. Default English output is unchanged when no override is set.
