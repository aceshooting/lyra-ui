---
"@aceshooting/lyra-ui": minor
---

`lyra-table`'s `[part='reveal-columns-button']` now renders only when a `priority` column is actually hidden by the `@container` breakpoints (or `showAllColumns` force-visible mode is active), instead of whenever any column merely declares a `priority`; the new `columnsHidden` reactive property and `lyra-columns-hidden-change` event expose the same real-time state to consumers.
