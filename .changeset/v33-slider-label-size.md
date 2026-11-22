---
'@aceshooting/lyra-ui': major
---

`lr-slider`'s label now uses the form-control label size: `--lr-form-control-label-font-size`
defaults to `var(--lr-font-size-md-sm)` instead of `inherit`, so a slider label matches the
`lr-input` and `lr-select` labels beside it.

## Migration

A slider whose label should keep following the surrounding font size sets
`--lr-form-control-label-font-size: 1em` on the slider (not `inherit`, which a custom property
applies to itself). A slider that already set the token to `var(--lr-font-size-md-sm)` can drop it.
