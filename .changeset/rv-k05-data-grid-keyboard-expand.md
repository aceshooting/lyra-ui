---
"@aceshooting/lyra-ui": major
---
lr-data-grid: tree rows, row-detail panels and group rows can now be expanded and collapsed from the keyboard. On a row's first cell ArrowRight expands a collapsed row and ArrowLeft collapses it or moves a collapsed nested tree row to its parent (swapped under RTL), emitting the usual expand/collapse events. Migration: on the first cell of a collapsed expandable row, the first ArrowRight now expands it; press ArrowRight again to move to the next cell.
