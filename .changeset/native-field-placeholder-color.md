---
"@aceshooting/lyra-ui": patch
---

Fix nine components (`lr-combobox`, `lr-eval-dataset`, `lr-command-palette`, `lr-table`,
`lr-tool-select-dialog`, `lr-code-editor`, `lr-message-feedback`, `lr-model-select`, `lr-voice-picker`)
whose native `<input>`/`<textarea>` themed background/color/border correctly but left `::placeholder`
at the browser's fixed light-tuned default -- each field's placeholder text now uses
`--lr-color-text-quiet`, with Firefox's reduced default `::placeholder` opacity undone on the
`type="search"` fields.
