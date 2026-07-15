---
"@aceshooting/lyra-ui": minor
---

`lyra-input` and `lyra-textarea` now also emit native-style `input`/`change` events (composed,
matching the native element's own timing) alongside the existing `lyra-input`/`lyra-change`
aliases, so consumers migrating from a native `<input>`/`<textarea>` don't need to rename their
listeners. Both components also forward `spellcheck`, `autocapitalize`, `autocorrect`,
`inputmode`, and `enterkeyhint` to their internal native control.
