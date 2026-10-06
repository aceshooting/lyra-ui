---
"@aceshooting/lyra-ui": major
---
`lr-date-input` renders its nested `lr-date-picker` only while the calendar is open or closing, and each opening starts at the value's month. Migration: open the field (`await el.show()`) before reaching for `::part(date-picker)` or the nested picker.
