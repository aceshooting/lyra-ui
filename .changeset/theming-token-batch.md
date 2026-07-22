---
"@aceshooting/lyra-ui": minor
---

Add theming tokens for surfaces that previously forced consumers through `::part()` overrides.

- `<lr-icon-button>`: `--lr-icon-button-background`, `--lr-icon-button-background-hover`, and
  `--lr-icon-button-color`, so a bordered or tinted icon button no longer needs `::part(button)`.
- `<lr-button>`: `--lr-button-shadow` (default `none`) for themed elevation.
- `<lr-table>`: sorted-header theming tokens, plus a specificity fix so consumer `::part()` rules can
  actually win against the internal sort-state rule.
- `<lr-select>` and `<lr-model-select>`: selected-state tokens; `<lr-combobox>` gains the matching
  `option-selected` token indirection.
- `<lr-empty>`: `--lr-empty-compact-font-size` for compact heading typography.
- `<lr-typing-indicator>`: `--lr-typing-duration`, so its speed is no longer keyed off the shared
  `--lr-transition-ambient`.
- `<lr-conversation-item>`: tokenized active-row indicator part.

Every token's `var()` fallback is the value it replaces, so unset rendering is unchanged.
