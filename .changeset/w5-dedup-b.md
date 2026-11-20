---
'@aceshooting/lyra-ui': patch
---

- `lr-terminal` reports text selections through the shared selection observer, so a keyboard or touch selection that settles inside the viewport now fires `lr-text-select`, and its download uses the shared Blob download helper.
- `lr-svg-viewer` keeps on-image region targets for several highlights until their minimum hit areas overlap, matching `lr-document-preview` and `lr-highlight-layer`, and moves focus to the matching control when the presentation switches.
- `lr-model-select` and `lr-voice-picker` share their declarative field properties and template handlers through the common catalog-picker base; `lr-select` and `lr-combobox` share option guards and value normalization.
- Hierarchy source hosts (`lr-tree`, `lr-file-tree`, `lr-trace-tree`, `lr-span-waterfall`, `lr-task-list`, `lr-xml-viewer`) share source-summary formatting, row-authority guards and active-row reveal.
