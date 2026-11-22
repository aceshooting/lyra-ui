---
'@aceshooting/lyra-ui': minor
---

`<lr-token-input>` gains `max-tags`/`min-tags` (localized `rangeOverflow`/`rangeUnderflow` validity), the
`with-clear`/`clearable` button (`clear-button` part, `clear-icon` slot, `lr-clear` event), the `blank` and
`readonly` custom states, an `inputValue` property, string assignment to `value`, the cancelable per-token
`lr-create` event, and the `tag-input`, `tags`, `tag`, `tag__content` and `tag__remove-button` part aliases.
Every character of `delimiter` now commits the draft and splits a paste (previously a multi-character
delimiter was matched as one literal sequence), and a part can carry several names, so match
`[part~="token"]` instead of `[part="token"]`. `<lr-combobox>` gains `dataSource` (alias of `source`),
`reload()` (alias of `refresh()`), `filter-debounce` (alias of `source-delay`) and the `lr-options-request`
and `lr-options-error` events.
