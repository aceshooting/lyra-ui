---
"@aceshooting/lyra-ui": patch
---

`lr-terminal`, `lr-ingestion-queue` and `lr-dataset-viewer`: forward the CSS parts rendered through
their internal `<lr-virtual-list>` so a consumer can actually reach them.

All three already styled those parts correctly from their own stylesheets, but none forwarded
`exportparts` from the `<lr-virtual-list>` element. Because the rows are `renderItem`'s output and
therefore live inside that element's own shadow root, a consumer rule like
`lr-terminal::part(line)` matched nothing at all — the documented parts were unreachable from
outside the component.

- `lr-terminal` now exports `line`.
- `lr-ingestion-queue` now exports `item`, `item-header`, `item-name`, `item-progress`,
  `item-meta`, `item-error`, `item-actions`, `retry-button` and `cancel-button`.
- `lr-dataset-viewer` now exports `data-row`, `cell`, `cell-highlight` and `cell-highlight-action`.

No styling changed and no new parts were added.
