---
"@aceshooting/lyra-ui": major
---
The searchable country, time-zone, unit and currency pickers now place their list with `absolute` like the compact mode, instead of the combobox's `fixed`, unless `positioning-strategy` or `--lr-positioning-strategy` says otherwise. Migration: set `positioning-strategy="fixed"` (or the cascading property) where the list must escape a clipping container.
