---
"@aceshooting/lyra-ui": minor
---

`<lyra-combobox>`: the input's accessible name now checks a host-level `aria-label` attribute before
falling back to `label`/`placeholder`/`"Combobox"` — previously a plain `aria-label` on
`<lyra-combobox>` was silently ignored. Matches the same fix in `<lyra-select>`.
