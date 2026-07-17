---
"@aceshooting/lyra-ui": minor
---

Adds `<lyra-voice-picker>`: a TTS voice selector mirroring `lyra-model-select`'s closed-dropdown/
free-text-combobox dual mode and form-association, with a `catalog` entry shape carrying
`language`/`description`/`previewUrl`, and an event-first preview affordance (`lyra-preview-request`,
cancelable) that plays through one internal `<audio>` when a `previewUrl` is present and the host
doesn't take over. No TTS SDK, no catalog fetching, no selection persistence — those stay host
concerns.
