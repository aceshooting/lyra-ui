---
"@aceshooting/lyra-ui": minor
---

Adds `<lyra-av-player>`: an audio/video player built on a native media element with a cue transcript
synced to playback, `time-range` anchor/highlight support, an optional dependency-free waveform
(peaks-in, no in-component decoding), playback-rate control, and imperative transcript search.
Self-registers into the document-viewer registry for the common audio/video MIME types. Owns
recorded-media transcript sync — distinct from `lyra-transcript-feed` (live voice-session captions)
and from `lyra-playback` (an index stepper, no media).
