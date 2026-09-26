---
'@aceshooting/lyra-ui': minor
---

`lr-combobox`'s "+N" selected-tag overflow indicator now carries a second, distinguishing `tag-overflow` part alongside `tag` (`part="tag tag-overflow"`), matching `<lr-select>`'s identical two-part overflow chip so `::part(tag-overflow)` can style just that indicator. `lr-filter-bar` forwards it from a `multiple` `'combobox'` filter as `filter-control-tag-overflow`.
