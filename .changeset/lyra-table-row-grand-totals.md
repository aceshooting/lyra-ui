---
"@aceshooting/lyra-ui": minor
---

`lyra-table` gains `rowTotal`/`grandTotal`: a trailing column showing each row's total (`rowTotal`)
and, when at least one column also defines `footer`, a grand-total cell at its bottom-right
intersection (`grandTotal`). Both share the existing `footer(rows)` hook's "consumer computes/renders,
table only positions" contract rather than assuming addition. Previously a consumer needing row/grand
totals alongside `lyra-table`'s existing per-column `footer` had to render them outside the table
entirely, breaking column alignment.
