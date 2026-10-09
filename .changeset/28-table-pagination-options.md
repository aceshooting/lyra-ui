---
"@aceshooting/lyra-ui": minor
---

`<lr-table>` forwards its built-in pager's options: `pagination-with-summary` (`paginationWithSummary`) shows the item-range summary at the inline start of the footer with the controls at the inline end, and `pagination-format` (`paginationFormat`, `'compact'` by default, or `'standard'`) selects the pager format. The nested pager's parts are exported with a `pagination-` prefix (`pagination-summary`, `pagination-controls`, `pagination-pages`, `pagination-page`, `pagination-page-current`, `pagination-page-field`, `pagination-page-input`, `pagination-page-count`, `pagination-button`), so they can be styled without reaching into `::part(pagination)`.
