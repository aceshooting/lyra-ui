---
"@aceshooting/lyra-ui": minor
---

`<lr-textarea>` gains `--lr-textarea-focus-border-color`, the last missing member of the
resting/hover/focus border-colour quartet its siblings already publish. Unset, it resolves to the
field's own resting border colour, so a textarea with no override renders exactly as it did before
— only the shared focus halo and the native outline told a focused field apart from a resting one
until now.

The same asymmetry — a border or fill that only some interaction states could retint — was also
found and closed on `<lr-model-select>` (`--lr-model-select-trigger-border-color`,
`--lr-model-select-trigger-fill`), `<lr-voice-picker>` (`--lr-voice-picker-trigger-border-color`,
`--lr-voice-picker-trigger-fill`), `<lr-code-editor>` (`--lr-code-editor-border`,
`--lr-code-editor-fill`), `<lr-emoji-picker>` (`--lr-emoji-picker-search-border-color`,
`--lr-emoji-picker-search-fill`) and `<lr-color-picker>` (`--lr-color-picker-border-color`) — each
already had an independently themeable hover, open, or invalid state but a hardcoded resting one.
Every new hook is read through an inline `var()` fallback and never declared on `:host`, so nothing
renders any differently until a consumer sets one, and each can still be set on an ancestor to
retheme a group at once.
