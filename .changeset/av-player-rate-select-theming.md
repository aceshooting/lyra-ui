---
"@aceshooting/lyra-ui": patch
---

Fix `lr-av-player`'s playback-rate `<select>` rendering raw browser chrome with an unthemed
(typically white) option popup regardless of theme -- it now resets native appearance, themes its
option list, and gains hover/focus-visible states and a decorative chevron in place of the removed
native one.
