---
"@aceshooting/lyra-ui": patch
---

`lr-video` with `fit="contain"` keeps full-width media with the controls below it when a narrow player sits in a parent without a set height, and `play()` no longer reloads the clip after an edit to a `<track>` attribute alone. `lr-combobox` clears a highlighted option when `loading` changes and hides it, so the highlight never returns on a different option.
