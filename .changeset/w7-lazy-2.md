---
'@aceshooting/lyra-ui': major
---

Register more optional composed children on first use.

- `lr-attachment-trigger`'s default entry registers `lr-dropdown` and `lr-menu-item` the first time it offers more than one capability, `lr-eval-dataset` registers its search `lr-input` the first time `searchable` is set, `lr-document-compare` registers `lr-document-preview` the first time `view="side-by-side"` renders, `lr-approval-queue` registers `lr-tool-approval-dialog` the first time a request opens, and `lr-rag-answer` registers `lr-grounding-summary` the first time an `assessment` is set.
- For every composite that registers children on first use, the host's `updateComplete` now also waits for the newly registered children's first render.

Migration: code that reads `customElements.get()` for one of these children right after importing only the host's entry must import the child's own `components/lr-*.js` entry, or await the host's `updateComplete` after it renders the child.
