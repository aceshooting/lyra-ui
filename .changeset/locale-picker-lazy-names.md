---
'@aceshooting/lyra-ui': patch
---

`lr-locale-picker` no longer resolves every offered locale's native name during its first render. A closed picker resolves only the locale its trigger shows, or none when that row supplies a non-blank `label`; the other rows resolve when the listbox opens or when typeahead or search needs them, then stay cached. Supplying `{ tag, label }` rows keeps `Intl.DisplayNames` out of the closed render entirely. Option labels, ordering, typeahead, search and events are unchanged.
