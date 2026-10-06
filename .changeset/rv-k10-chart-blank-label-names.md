---
"@aceshooting/lyra-ui": patch
---
lr-box-plot and lr-lite-chart: a series with a blank `label` no longer produces an accessible chart name such as " and Sales" or an empty data-table header; blank labels are left out of the name, and blank series/category headers fall back to the localized series label or the category's position.
