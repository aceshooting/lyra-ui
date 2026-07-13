---
"@aceshooting/lyra-ui": minor
---

`lyra-json-viewer`'s root-node toggle/copy fallback words ("array"/"object"/"value", used only when a
node has no key label) now route through `this.localize()`, overridable via `.strings`/
`registerLyraLocale()`. Default English text is unchanged.
