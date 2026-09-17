---
"@aceshooting/lyra-ui": minor
---

`<lr-filter-bar>`: add a public read-only `hasChangedFilters`.

`hasActiveFilters` answers "does any filter hold a value", which is deliberately `true` for a bar
whose filters were declared with their own non-empty `defaultValue` and have never been touched —
so a host that wanted to show "3 filters applied", enable an "Apply"/"Save search" action, or badge
a collapsed filter panel had to re-derive the default comparison itself from `filters` and `value`.
`hasChangedFilters` exposes it directly, using the exact equality `activeFiltersDisplay: 'changed'`
already filters its chip row on: a `readonly string[]` default compares positionally, everything
else compares with `Object.is`, and a filter with no declared `defaultValue` counts as changed the
moment it holds any value at all. Clearing a filter that *does* declare one also counts as changed,
since `reset()` would restore it — which is the one case where it differs from the `'changed'` chip
row, whose entries are non-empty values by construction.

`hasActiveFilters` is unchanged, and so is every existing behaviour keyed on it.
