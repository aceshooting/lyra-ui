---
"@aceshooting/lyra-ui": major
---
lr-tree: `lr-selection-change` now also fires when a `data` refresh changes the self-managed selection (a selected row removed, or re-seeded by an explicit `selected`), not only after a user selection. Migration: if a listener treats every `lr-selection-change` as a user action, check whether the change came from your own `data` assignment.
