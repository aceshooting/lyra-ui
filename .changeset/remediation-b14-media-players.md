---
'@aceshooting/lyra-ui': patch
---

- `lr-video`: the timeline range now shows a visible keyboard focus ring and a forced-colors-safe track and fill.
- `lr-video`: activating the poster play button keeps keyboard focus on the player instead of dropping it to the page.
- `lr-video`: the scrub preview stays inside the player, removing the volume attribute restores the default volume, muted autoplay is skipped under reduced motion, and an unread thumbnail response body is released.
- `lr-video`: adds `toggle()` as an alias of `togglePlay()`.
- `lr-av-player`: marks the playback position on the timeline with a playhead (`timeline-playhead` part), names each highlight marker with its time range, and accepts Up/Down/PageUp/PageDown on the timeline.
- `lr-av-player`: transcript search ignores accents, the current cue stays distinguishable in forced colors, caller cue text isolates its direction, and an authored playback rate no longer emits `lr-rate-change` at mount.
- `lr-video-playlist`: swapping videos keeps keyboard focus inside the playlist, and row navigation clamps at the ends.
- `lr-animated-image`: a load that finishes while the element is detached is kept, and focus returns to the play button after a source change.
- `lr-animation`: removing `iterations` restores the infinite default.
- `lr-sequence-playback`: removing `interval-ms` restores the default interval, and `autoplay-interval` is accepted as a second spelling.
- `lr-flag`: the inset ring is drawn above the image and the loading skeleton follows the flag shape and radius.
- `lr-qr-code`: modules are painted in a single path.
