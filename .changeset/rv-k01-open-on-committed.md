---
"@aceshooting/lyra-ui": major
---
`lr-select`, `lr-locale-picker` (and the country, time-zone, unit and currency pickers) now open on the committed option, active and scrolled into view; `lr-combobox` does the same when ArrowDown/ArrowUp opens it. Migration: the first ArrowDown after opening moves to the option after the committed one instead of the first row, so key sequences and tests that count arrow presses from the first row need one press fewer when a value is committed.
