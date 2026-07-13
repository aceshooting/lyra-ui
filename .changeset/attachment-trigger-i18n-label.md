---
"@aceshooting/lyra-ui": minor
---

`<lyra-attachment-trigger>`: added a `triggerLabel` property (`trigger-label` attribute) that overrides the single-capability trigger button's `aria-label`, which previously came unconditionally from the built-in `CAPABILITY_META` table (e.g. `'Attach files'`, `'Attach an image'`, `'Use camera'`). Lets a host localize the accessible name without forking the component. Unset (the default) preserves today's exact `CAPABILITY_META`-derived label for every capability.
