---
"@aceshooting/lyra-ui": patch
---
lr-audio-visualizer stops its draw loop and suspends its AudioContext once every analysed track has ended, and reads the reduced-motion preference on change instead of every frame.
