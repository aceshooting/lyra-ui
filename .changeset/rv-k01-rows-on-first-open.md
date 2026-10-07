---
"@aceshooting/lyra-ui": major
---
`lr-select`, `lr-combobox` and the catalog pickers mount their option rows the first time the listbox opens, so a closed picker with hundreds of options stays cheap. Migration: code and tests that read `[part="option"]` from a closed picker's shadow root must open it first.
