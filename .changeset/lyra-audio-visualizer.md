---
"@aceshooting/lyra-ui": minor
---

Adds `<lyra-audio-visualizer>`: a presentational, canvas-drawn voice-activity visualization (bars or
waveform), driven by a `MediaStream` (lazily wired to a WebAudio analyser), a numeric `level`, or a
`state` (`idle`/`listening`/`thinking`/`speaking`) alone for an ambient animation. Pairs with
`lyra-push-to-talk`'s `stream`/`lyra-level` output. Zero dependencies — native Web Audio only,
reduced-motion-aware.
