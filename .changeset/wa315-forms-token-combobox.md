---
'@aceshooting/lyra-ui': minor
---

`<lr-token-input>` gains `max-tags`/`min-tags` (localized `rangeOverflow`/`rangeUnderflow` validity), the
`with-clear`/`clearable` button (`clear-button` part, `clear-icon` slot, `lr-clear` event), the `blank` and
`readonly` custom states, an `inputValue` property, string assignment to `value`, the cancelable per-token
`lr-create` event, and the `tag-input`, `tags`, `tag`, `tag__content` and `tag__remove-button` part aliases.
`delimiter` keeps its existing meaning: a multi-character delimiter is matched as one literal
sequence and pasting does not commit by itself. Because a token part now carries several names,
shadow-root queries should match `[part~="token"]`; `::part(token)` selectors are unaffected. `<lr-combobox>` gains `dataSource` (a
single-argument `{ query, signal }` provider that may return option objects, option elements or option
markup, read as text only; `source` keeps its own call shape), `reload()` (alias of `refresh()`),
`filter-debounce` (alias of `source-delay`, keeping its 200ms default), the `lr-options-request` and
`lr-options-error` events, a `server` mode that announces requests and skips client-side filtering,
`currentOption`, the `empty`, `no-results` and `loading` slots with matching `status` parts, an in-field
`spinner` part shown while options load, the `loading` and `showing-loading-row` custom states, and the
`tag__remove-button__button` part alias. Match `[part~="tag__remove-button"]` in shadow-root queries.

`<lr-token-input>` also gains `with-label`/`with-hint`, `resetValidity()`, a static `validators`
catalog, the lowercase `inputmode`/`enterkeyhint` property aliases, a reflected `allow-duplicates`,
a `name` setter that accepts `null`, and a `value` attribute that accepts delimiter-separated text
beside the JSON array form (text that is not a JSON array now becomes tokens instead of an empty
list). The `value` property still reads a frozen `readonly string[]`.
