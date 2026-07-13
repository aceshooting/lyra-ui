---
"@aceshooting/lyra-ui": minor
---

`lyra-attachment-trigger`'s single-capability trigger `aria-label`s ("Attach files"/"Attach an
image"/"Use camera"), its multi-capability menu's "Add attachment" label/aria-label, and its menu
item labels ("Upload files"/"Upload a photo"/"Take a photo") now route through `this.localize()`,
overridable via `.strings`/`registerLyraLocale()`. Default English output is unchanged when no
override is set.
