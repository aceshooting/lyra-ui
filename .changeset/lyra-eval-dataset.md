---
"@aceshooting/lyra-ui": minor
---

New `<lr-eval-dataset>` component: dataset management for an evaluation suite -- a filterable,
taggable list of `EvalExample` rows (`id`, `input`, `expectedOutput?`, `tags?`, `metadata?`) with
add/remove/import/export affordances. Fully controlled, matching this library's established
convention for the rest of the agentic-AI orchestration layer: `examples` is the host's own data,
and the component never mutates it or performs any I/O itself -- every action fires an
`lr-example-select` / `lr-example-add-request` / `lr-example-remove-request` /
`lr-import-request` / `lr-export-request` event and the host decides how to act on it.

Composes `<lr-data-grid>` for the row list, `<lr-chip>`/`<lr-chip-group>` as a toggleable,
OR-matched tag-browse filter, `<lr-file-input>` for the import affordance, and
`<lr-export-button>` for the export affordance (its own built-in client-side download is
suppressed so every configured format routes through `lr-export-request` uniformly). Ships with a
searchable free-text filter, RTL and 320px-allocation coverage, and localized strings with
`.strings` override support.
