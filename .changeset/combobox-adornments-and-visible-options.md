---
"@aceshooting/lyra-ui": minor
---

`<lr-combobox>` now renders `<lr-option>`'s adornment slots, and gains `visibleOptions` for bounding
the suggestion popup's height.

**Adornments (a fixed contract, not just a new feature).** `<lr-option>` documented `start`/`end`
slots, their `prefix`/`suffix` aliases, and four matching CSS parts — but `<lr-combobox>` builds its
popup from normalized row *data* rather than from the light-DOM nodes, so inside the one component
`<lr-option>` exists to feed, none of them rendered. A row could show a colour dot, a badge and a
sub-line but not a 16px image, which is the one adornment a country, currency, language or user
picker most often wants, and neither documented workaround was available (`::part(option)` cannot be
compounded past the part, and `dot-color` rejects `url()`).

Adornments now render as new `option-start` / `option-end` parts, inert and `aria-hidden` so they
never join the option's accessible name. The nodes are **cloned** into the row, so the author's own
`<lr-option>` subtree is left exactly where they put it rather than being moved into a shadow root
as a side effect of opening a dropdown. Async `source` rows can supply the same `start`/`end`
fields alongside the existing `icon`.

**`visibleOptions`** (`visible-options`) bounds the popup to about that many rows, leaving the rest
reachable by scrolling. It is measured from where row N actually starts, since a row's height varies
with sub-lines, adornments and group labels. Unset, the listbox keeps exactly its previous
max-height behavior.

The doc comments on all three caps — `visibleOptions`, `maxRender`, and `maxOptionsVisible` — now
each state how they differ from the other two, which was the confusion that prompted this.
