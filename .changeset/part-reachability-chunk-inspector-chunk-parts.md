---
"@aceshooting/lyra-ui": minor
---

Fix `lr-chunk-inspector`'s entire chunk-row styling never applying above `virtualize-at`, and make
every row-level part reachable from a consumer stylesheet.

Past the threshold the row template becomes `lr-virtual-list`'s `renderItem`, whose result is
committed inside that element's **own** shadow root — one boundary below this component's. A bare
`[part='chunk']` selector cannot cross that boundary, so a long chunk list lost its row layout and
separators, the score line's size/color/tabular figures, the score bar and its tone-mapped fill, the
line clamp on the collapsed text preview, and the borderless brand styling on the open and
show-more buttons, which fell back to the raw browser button appearance. Both documented custom
properties (`--lr-chunk-inspector-current-bg`, `--lr-chunk-inspector-current-color`) were dead
there too. Every rule now pairs its original selector with an `lr-virtual-list::part(…)` arm, so
both rendering paths present identically — below the threshold the rows are still rendered into this
component's own shadow root, where the bare selector is the one that matches.

`::part()` cannot be followed by an attribute selector, and it cannot be followed into the matched
element's subtree either, so row state is now carried by an additional part name (added alongside
the base name as a part list — `::part()` carries `part~=` semantics, so both names match the same
element):

- **New:** `chunk-current` — the row matching `activeId`.
- **New:** `score-current` — that row's score line, previously reached through a descendant
  selector no `::part()` can express.
- **New:** `score-fill-success`, `score-fill-warning`, `score-fill-danger` — the score bar fill in
  each scoring tier.
- **New:** `text-clamped` — the text preview while still collapsed.

The `aria-current`, `data-tone` and `data-clamped` attributes are unchanged and still describe each
element's state.

While virtualized, the chunk row no longer carries its own `role="listitem"`: `lr-virtual-list`
already wraps every row it renders in one, and the nested duplicate left the inner list item with a
list-item rather than list parent — an invalid ARIA containment that axe flags.

The internal `lr-virtual-list` now forwards every row part through `exportparts`, so
`lr-chunk-inspector::part(chunk)` and friends work from a consumer stylesheet in both paths.
