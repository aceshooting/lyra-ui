---
'@aceshooting/lyra-ui': patch
---

The migration inventory now targets Web Awesome 3.15.0. It records `lr-stepper`/`lr-step`, `lr-token-input` and `lr-code-block` as the counterparts of `wa-stepper`/`wa-step`, `wa-tag-input` and `wa-code-highlighter`, and `lyra-ui-migrate` rewrites the exported parts that Web Awesome 3.15 deprecated to their replacements: `wa-tooltip` `base`/`base__popup`/`base__arrow`, `wa-button-group` and `wa-tab-panel` `base`, `wa-color-picker` `base`/`eyedropper-button__base`/`format-button__base`, `wa-dialog`/`wa-drawer` `close-button__base`, `wa-select` `label`/`tag__remove-button__base` and `wa-slider` `tooltip__base`. The reviewed Web Awesome Pro snapshots now record the 3.15 combobox async-options surface, the exported parts of `wa-date-input` and `wa-file-input`, and the stable status of date input, date picker, data grid, video and video playlist.
