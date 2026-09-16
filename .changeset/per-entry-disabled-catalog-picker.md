---
"@aceshooting/lyra-ui": minor
---

`<lr-model-select>` and `<lr-voice-picker>` catalog entries accept `disabled`. A disabled row renders
as a genuinely non-actionable control — no tab stop, no hover or press affordance — and keyboard
navigation steps over it without stranding focus. Both components share one catalog entry type, so
the contract cannot drift between them. An entry that does not set it renders exactly as before.
