---
"@aceshooting/lyra-ui": minor
---

`lyra-model-select` gains an opt-in `hint`/`error-text` form-control chrome (matching named slots and `hint`/`error` CSS parts, mirroring `lyra-select`, with `aria-describedby` wired to the rendered ids), plus `spellcheck`/`autocapitalize`/`autocorrect` passthrough and bubbling `blur`/`focus` events on the free-text mode's internal `<input>`. All additive — a bare `<lyra-model-select>` with none of these set renders byte-identical to before.
