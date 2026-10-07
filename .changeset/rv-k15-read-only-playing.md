---
"@aceshooting/lyra-ui": major
---
lr-video and lr-sequence-playback: `playing` is now read-only live state like lr-animated-image's, so assigning it throws in strict-mode code and an authored `playing` attribute no longer starts playback. Replace `el.playing = true`/`false` (or a bound `playing` prop) with `play()`/`pause()`/`toggle()` (`togglePlay()` on lr-video), and `<lr-sequence-playback playing>` with a `play()` call.
