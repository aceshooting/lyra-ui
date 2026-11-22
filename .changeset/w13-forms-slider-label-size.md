---
'@aceshooting/lyra-ui': minor
---

`lr-slider`: the label keeps inheriting the surrounding font size by default. To match the `lr-input` and `lr-select` label size, opt in with `--lr-form-control-label-font-size: var(--lr-font-size-md-sm)` on the slider or a containing form. The visible readout continues to show the localized number unless `value-display="formatted"` is set; this is now documented.
