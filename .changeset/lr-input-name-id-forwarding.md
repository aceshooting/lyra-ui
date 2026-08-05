---
"@aceshooting/lyra-ui": patch
---

Fix: `<lr-input>` now forwards `name` and a host-supplied `id` to its internal native `<input>`, restoring password-manager autofill/save detection for shadow-DOM-aware password managers that key field detection off the actual control's `name`/`id` rather than `autocomplete` alone. The internal `<label for>` tracks whichever id is in use. Leaving `id` unset keeps the internal input at `id="input"`, unchanged from before.
