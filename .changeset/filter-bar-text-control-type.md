---
"@aceshooting/lyra-ui": minor
---

`<lr-filter-bar>` gains a `'text'` filter type, composing `<lr-input>` for an open-ended query, plus
an optional per-filter `debounce` (ms). A dashboard whose toolbar is a search box next to a few
dropdowns can now be a single filter bar — the search box participates in the same `value` object,
the same removable active-filter chips (shown verbatim, so a query containing a slash is no longer
mangled), the same reset button and `loading` state — and can delete its own hand-rolled debounce
timer. A pending debounce is flushed by the field's own change/blur and cancelled by `reset()`, a
chip removal, and disconnection, and the text field stays uncontrolled-with-sync so a re-render
mid-typing never disturbs the caret.
