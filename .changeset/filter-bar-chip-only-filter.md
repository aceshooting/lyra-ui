---
"@aceshooting/lyra-ui": minor
---

**`<lr-filter-bar>`: a control-less `type: 'chip'` filter, for a value owned by a widget elsewhere
on the page.**

A calendar heatmap cell, a map selection, a chart brush — the filter is real, but the control that
sets it is not in the toolbar. Until now the only way to surface such a filter in the bar was a
`type: 'custom'` definition whose renderer drew something inert just to occupy the cell it was
forced to claim.

`type: 'chip'` renders **no control and no toolbar cell**: no `field` wrapper is emitted for it, so
`lr-filter-bar::part(field)` and `::part(field-<filterId>)` never match one, and a bar whose filters
are *all* chip-only paints no empty column — its `controls` row still renders the reset button (the
"clear all" action such a bar needs), the `end` slot and the loading spinner, exactly like a bar
declaring no filters at all.

Everything else is unchanged from any other filter type. The value lives in `value` under its own
filter ID, rides every `lr-input`/`lr-reset` detail, counts toward `hasActiveFilters` (so it enables
the reset button) and toward `invalidFilterIds` when `required`, renders a removable active-filter
chip subject to `activeFiltersDisplay`, and is cleared both by removing that chip and by `reset()`.
A `required` chip-only filter is honoured in bookkeeping only — it joins `invalidFilterIds`, fails
`checkValidity()` and moves `lr-validity-change` — but renders no inline error, because the bar
renders no element of its own for it; the owning widget keeps its own error affordance. The
inherited `placeholder` is inert here for the same reason it already is for `type: 'custom'`.

**Chip text.** An optional `formatValue(value, locale)` produces it, and `locale` is the bar's
`effectiveLocale` — the same locale every built-in type's own chip formatting and a custom adapter's
`formatValue` already receive, so the caller localizes its own data. Omitted, the fallback ladder is
the one a custom adapter's omitted `formatValue` uses: a string array renders as a localized
conjunction list, anything else renders verbatim through `String(value)`, and an unset value renders
empty. Verbatim is exact — a chip-only value never passes through the date branch that localizes a
`'date'`/`'date-range'` chip, so an ISO day is not silently reformatted and a value containing a
slash is not mangled.

**Clearing.** An optional `clearValue` (default `''`, what every non-multi built-in type writes) is
what a chip removal writes; declare `[]` for an array-valued chip-only filter. An optional `isEmpty`
overrides the built-in emptiness rule. A domain sentinel must pair the two: a sentinel clear value
with no matching `isEmpty` leaves the bar reading the "cleared" value as still set and still
rendering a chip for it — the identical pairing a custom adapter's own `clearValue`/`isEmpty`
already documents. With the pair declared, the sentinel is never stored in `value` and an absent key
reads back as the sentinel for the owning widget.

**Additive only.** A schema declaring no `'chip'` filter renders byte-identical shadow DOM: the
render path keys on `type === 'chip'` exactly, never on "not a known control type", so an
unrecognized `type` still falls back to `<lr-select>` as before. At the type level, a `'chip'` filter
keeps the full unconstrained field value in `LyraFilterBarValueFor<Defs>`, like `'custom'`. New
exported type: `LyraFilterBarChipDefinition`.
