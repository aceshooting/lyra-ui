---
"@aceshooting/lyra-ui": major
---
lr-switch and lr-radio-group now dispatch `input` as a plain `Event`, as native checkboxes and radios do, instead of an `InputEvent`. Migration: stop checking `instanceof InputEvent` or typing the handler as `InputEvent`, and read `event.target.checked` or `event.target.value`.
