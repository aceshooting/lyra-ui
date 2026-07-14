---
"@aceshooting/lyra-ui": minor
---

`lyra-mention-popover` now honors a host-level `aria-label` attribute as the accessible name for its internal `role="listbox"` popup, taking priority over the `label` property and its localized default. Previously the popup's name came only from `label`/`localize()`, so a plain `aria-label` set on `<lyra-mention-popover>` itself was silently ignored — matches the same fallback already used by `lyra-combobox`/`lyra-table`.
