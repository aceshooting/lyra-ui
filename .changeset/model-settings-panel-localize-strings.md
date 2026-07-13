---
"@aceshooting/lyra-ui": minor
---

`lyra-model-settings-panel`'s hardcoded English strings — the visible "Temperature" caption
(also reused as the nested `lyra-slider`'s accessible name) and the internal `lyra-model-select`'s
"Select a model…" placeholder — now route through `this.localize()`, overridable via
`.strings`/`registerLyraLocale()`. Default English output is unchanged when no override is set.
