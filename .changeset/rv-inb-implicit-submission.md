---
"@aceshooting/lyra-ui": patch
---
Pressing Enter in `lr-input`, `lr-number-input`, `lr-combobox`, `lr-date-input`, `lr-time-input` and the other single-line controls now follows the platform when the form's first submit button is disabled (directly or by a `<fieldset disabled>`): nothing is submitted, where before a later submit button was activated or the form was submitted without a submitter.
