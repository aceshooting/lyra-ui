---
"@aceshooting/lyra-ui": minor
---

Re-audited every component against the library's i18n/RTL/theming standard and fixed the
remaining gaps found:

- Removed several `this.localize(key, literalFallback)` call sites (`toolApprovalHeading`,
  `playback`'s play/pause/position labels, `model-settings-panel`'s temperature/model labels,
  `media-card`'s five accessible-name strings, `kbd`'s shortcut-token labels, `chat-composer`'s
  composer label) where the literal fallback silently defeated `registerLyraLocale()` translation
  for that call site.
- Routed remaining hardcoded strings through `this.localize()`: `date-picker`'s next-month label
  and `date-input`'s validation messages, `toast-item`'s/`chip`'s/`combobox`'s remove/close
  labels (now interpolated via a `{placeholder}` instead of string concatenation), `heatmap`'s
  matrix/calendar aria-labels and "no data"/row/col fallbacks, `chart`/`box-plot`'s description
  and data-table text, `lite-chart`'s mark-position announcement, `document-preview`'s empty-state
  nouns, `json-viewer`'s copy/expand/collapse/count labels, `stat`'s trend announcement,
  `dialog`'s `confirm()` cancel button, `typing-indicator`'s default label, `tool-param-form`'s
  edge-case validation message, and `tool-result-dialog`/`tool-call-chip`'s duration seconds unit.
- Fixed RTL gaps: `app-rail-item`'s icon tooltip now flips side under `dir="rtl"` via
  `rtlAwarePlacement()`, `chat-message`'s and `source-list`'s collapse/disclosure chevrons now
  mirror under RTL, and `lite-chart`'s roving-tabindex point navigation now swaps
  ArrowLeft/ArrowRight under RTL.

Also compressed the shared string registry (`internal/localization.ts`): removed 21 `kbd*` base
keys (`kbdEnter`, `kbdEscape`, `kbdTab`, etc.) that were fully superseded by their `*Word`/`*Visual`
counterparts and had no remaining call sites anywhere in the library, reducing the packed consumer
bundle size.
