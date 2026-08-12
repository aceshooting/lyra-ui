---
"@aceshooting/lyra-ui": minor
---

Remediate the confirmed findings of a full-library review sweep. Every change is additive: no public
member was removed or renamed, no default value or attribute polarity changed.

Accessibility and announcements:

- move `lr-transcript-feed` announcements out of its shadow `role="log"` and onto the shared
  light-DOM polite sink, leaving the shadow region non-live;
- give `lr-thinking-panel`'s always-tabbable scroll region a real focus ring and a distinct hover
  preview, matching `lr-code-block` and `lr-virtual-list`;
- draw `lr-mind-map`'s focus ring as soon as the widget takes focus, rather than only after the
  first arrow key;
- hand `lr-confirm-bar` focus to its status region when a host defers the decision, instead of
  dropping it to `<body>` while the just-activated button becomes `disabled`;
- name an icon-only toggleable `lr-chip`'s real control, and give `lr-phone-input` an accessible-name
  fallback;
- carry a persistent region landmark on `lr-dataset-viewer` in every fetch state;
- announce timeline and step position on `lr-video` and `lr-playback` through localized
  `aria-valuetext`;
- floor the `lr-flow-minimap` viewport rect and `lr-data-grid` hit targets to a real pointer size.

Security and correctness:

- widen the CSV formula-injection guard to fullwidth sigils and leading whitespace, and share one
  definition between `lr-data-grid` and the export helper instead of two drifted copies;
- drop an `lr-mcp-app` tool result whose originating frame has been replaced, via an additive
  `frameGeneration` correlation on the event detail and an optional `postToolResult()` argument;
- keep a cancelled `lr-animation` cancelled when the play state is later synced;
- report an honest failure when a concurrent `src` reassignment lands mid-anchor-resolution in the
  archive, CSV, and dataset viewers;
- guard `lr-code-block`'s async highlight continuations on `isConnected`;
- ignore a non-primary pointer button when starting an `lr-image-viewer` annotation.

Internationalization and theming:

- add `playbackStepPosition`, `phoneInputLabel`, and `emojiPickerLoadError`, translated into all ten
  shipped locale catalogs; `lr-phone-input` and `lr-emoji-picker` no longer borrow another
  component's message key;
- format `lr-grounding-summary` evidence offsets with the effective locale;
- wire Shiki's dark palette through `lr-markdown` and `lr-markdown-core`;
- give `lr-box-plot` and `lr-lite-chart` the chart family's forced-colors series encodings;
- fix an RTL double-mirror in `lr-chart`'s DOM legend placement by removing a redundant mirror
  rather than adding a third;
- stop re-mirroring MapLibre's physically-assigned popup anchors under `dir="rtl"`.

New opt-in surface:

- `lr-terminal` gains `compact` and `frame`, matching its agent-tools siblings;
- `lr-swatch-picker` gains `disabled`; `lr-context-meter` gains `showLegend` and legend parts;
- `lr-node-palette` gains `reorderable`; `lr-retrieval-results` gains custom grouping;
- `lr-knowledge-graph-explorer` gains a presettable `searchQuery`;
- `lr-xml-viewer` gains host-supplied highlights and attribute-path precision;
- `lr-box-plot` gains per-box keyboard and pointer interactivity;
- `lr-data-grid` accepts `'start'`/`'end'` as spelling aliases for the existing RTL-relative
  `'left'`/`'right'` pin sides, and renders its pager glyphs as mirroring icons;
- `lr-time-range` gains click-to-seek; `lr-filter-bar` options accept an icon;
- host `focus()`/`blur()`/`click()` forwarding and re-emitted focus/blur on `lr-av-player`,
  `lr-pan-zoom`, `lr-video`, `lr-video-playlist`, and `lr-zoomable-frame`.

Performance:

- resolve `lr-terminal` highlight ownership and search-match state in one pass per render instead of
  rescanning per line;
- cache tree ordering in `lr-subagent-panel`, status counts in `lr-test-results`, the filter/
  categorize/roving chain in `lr-node-palette`, the dedupe/sort/group pipeline in
  `lr-retrieval-results`, the folded-quote transform in `lr-email-viewer`, and the text index in
  `lr-docx-viewer` (now binary-searched);
- coalesce `lr-scroller`'s `lr-scroll` to one emission per animation frame.

Tooling and generated artifacts:

- stop the default-string slice generator from treating an incidental string literal in a helper
  module as a reachable message key, which had been pulling unused messages into component bundles;
- forward a README mirror row's migration note into the generated migration disposition;
- export the chart, graph, map, and geojson classes from the registration-free package root.
