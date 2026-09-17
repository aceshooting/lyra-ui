---
"@aceshooting/lyra-ui": minor
---

`<lr-filter-bar>`: under `activeFiltersDisplay="changed"`, the reset button now keys its enablement
on `hasChangedFilters` instead of `hasActiveFilters`.

`'changed'` exists to say that a filter sitting at its own declared `defaultValue` is not something
the user applied, and it already suppressed that filter's chip. The reset button next to the empty
chip row stayed enabled anyway, so a defaults-only bar rendered "nothing is applied" and "press here
to clear what's applied" side by side, and pressing it was a no-op that still emitted `lr-input` and
`lr-reset`.

Nothing else changes: enablement under `activeFiltersDisplay="all"` (the default) and `"hidden"` is
byte for byte what it was, `disabled`/`loading` still win in every mode, `hasActiveFilters` keeps its
meaning, and `reset()` itself is untouched — it still restores every declared `defaultValue`.
