---
'@aceshooting/lyra-ui': minor
---

`lr-funnel` and `lr-entity-card` now stretch their root `[part="base"]` to fill a CSS-Grid or flex row under the default `align-items: stretch`, instead of shrink-wrapping to their own content and leaving blank space below a taller sibling tile.

`lr-community-card`'s `compact` now also tightens `[part="base"]`'s padding and gap (new `--lr-community-card-compact-padding`/`-gap` hooks), matching its sibling `lr-entity-card`/`lr-source-card`. `lr-flow-node`'s `compact` now also tightens the header's own icon-to-heading gap (new `--lr-flow-node-compact-header-gap`). `lr-activity-feed`'s `compact` now also tightens the gap between an entry's icon/dot and its label/timestamp (new `--lr-activity-feed-compact-entry-gap`). `lr-thinking-panel`'s `compact` now also reduces the transcript body's font size (new `--lr-thinking-panel-compact-body-font-size`). `lr-source-list` gains new `compact` and `frame` properties (`'card' | 'plain'`), matching the density/chrome escape hatches its own slotted `lr-source-card` children already had.

`lr-activity-feed`'s `renderText` callback can now return a rich anchor that renders in the library's brand color instead of the browser's default link blue, via the new `--lr-activity-feed-entry-text-link-color` custom property, since the returned content lands inside a shadow root that page CSS and `::part()` cannot otherwise reach past the wrapper.
