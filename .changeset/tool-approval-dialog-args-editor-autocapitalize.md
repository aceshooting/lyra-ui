---
"@aceshooting/lyra-ui": minor
---

`lyra-tool-approval-dialog`'s raw-JSON args `<textarea>` now also hardcodes `autocapitalize="off"` and `autocorrect="off"` alongside its existing `spellcheck="false"`, so a mobile browser (notably iOS Safari, which defaults textarea `autocapitalize` to `'sentences'`) can no longer auto-capitalize or auto-correct JSON key/value text while a user edits tool-call arguments, silently corrupting the JSON.
