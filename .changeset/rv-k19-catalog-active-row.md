---
"@aceshooting/lyra-ui": major
---
lr-model-select and lr-voice-picker scroll only their listbox to keep the keyboard-active row visible, and opening the closed dropdown now starts on the committed row. Migration: keyboard sequences (and tests) that counted arrow presses from the first row now start from the committed value.
