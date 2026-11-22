---
'@aceshooting/lyra-ui': patch
---

`lr-slider`: the label now follows the form-control label size (`--lr-font-size-md-sm`, as `lr-input` and `lr-select` labels do) instead of inheriting the surrounding font size. `--lr-form-control-label-font-size` still overrides it. The visible readout continues to show the localized number unless `value-display="formatted"` is set; this is now documented.
