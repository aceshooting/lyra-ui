---
"@aceshooting/lyra-ui": patch
---

Docs: `llms/forms.md` now documents `<lr-select>`'s new `sync` property (same vocabulary note as
`<lr-combobox>`'s, stating its unset default), records that a width-synced listbox on **both**
controls is capped on `--lr-positioner-available-inline-size` alone rather than also by
`--lr-popover-viewport-clamp`, and describes `loading`'s coverage of an empty selection alongside
the `placeholder` entry it now takes precedence over.
