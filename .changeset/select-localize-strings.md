---
"@aceshooting/lyra-ui": minor
---

`lyra-select`'s required-field validation message ("Please select an option.") and its
trigger's fallback accessible name ("Select", used only when no `aria-label`, `label`, or
`placeholder` is set) now route through `this.localize()`, overridable via
`.strings`/`registerLyraLocale()`. Default English output is unchanged when no override is set.
