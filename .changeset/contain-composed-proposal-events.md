---
"@aceshooting/lyra-ui": patch
---

Composite components no longer leak their built-in children's events: `lr-knowledge-graph-explorer` and `lr-agent-trace` contain the legend's `lr-visibility-change-request`, `lr-table` the pager's `lr-before-page-change`, `lr-document-library`, `lr-retrieval-results`, `lr-source-picker` and `lr-rubric-form` their checkbox toggle requests (plus the checkbox `input`/`change`/`lr-input` events in results and source picker), `lr-document-viewer` its dialog's `lr-show`/`lr-after-show`/`lr-initial-focus`/`lr-request-close`/`lr-hide`/`lr-after-hide`, and `lr-tool-param-form` its selects' `lr-after-show`/`lr-after-hide`. Listen for each component's own documented events instead (for example `lr-hidden-types-change`, `lr-page-change`, `lr-selection-change`, `lr-select`, `lr-sources-change`, `lr-input` or `lr-close`).
