---
'@aceshooting/lyra-ui': patch
---

Improve component reliability and public contracts across the library:

- complete standalone theme inputs and semantic contrast coverage;
- export public component property and configuration types from the registration-free package root;
- preserve retrieval evidence locators through `lr-retrieval-trace`;
- honor slot-only answer and source content in `lr-rag-answer`;
- preserve keyboard focus when retrieval paths, chips, and source collections change;
- normalize invalid `lr-knowledge-base-admin` tab state to its Sources fallback;
- remove unintended nested card chrome from generated RAG sources and evaluation metrics;
- restore `lr-export-button` to sequential keyboard navigation after loading or disablement ends;
- report and announce `lr-diff-view` clipboard failures without falsely confirming stale or failed writes;
- isolate registered renderer dialog events so inner dialogs cannot close `lr-document-viewer`;
- surface nonfatal `lr-dataset-viewer` parser diagnostics while preserving recoverable rows;
- fully suppress the visible `lr-toast-item` progress animation under reduced motion;
- harden rendered safe-area coverage for every `lr-toast` placement in LTR and RTL;
- cover `lr-spinner`'s populated, forwarded visible-label accessibility state.
- reject excessive ZIP entry and declared-expansion metadata before `lr-archive-viewer` asks JSZip
  to materialize its entry graph.
- isolate fetched `lr-svg-viewer` content from author styles, SVG animation, and external resource
  references while retaining local paint servers.
- reject XML document type declarations before browser entity expansion and preserve mixed XML
  child-node source order in `lr-xml-viewer`.
- reconcile and announce retained `lr-xml-viewer` search state after XML reloads.
- place `lr-mcp-app`'s inline CSP before every app-controlled token so head decoys cannot bypass it.
- bound streamed ANSI CSI/OSC carry and recover `lr-terminal` after overlong unterminated sequences.
- restore `lr-tool-param-form`'s cloned initial value and pristine interaction state on native form reset.
- replace English `lr-test-results` status initials with language-neutral decorative marks.
- preserve `lr-code-block` and `lr-code-block-core` roving focus when controlled code shrinks.
- validate every `lr-box-plot` canvas theme color and fall back from invalid CSS expressions.
- materialize `lr-audio-visualizer` canvas colors, including `currentColor`, in the live theme scope.
- keep disabled, hidden, and inert custom controls out of `lr-message-actions` roving navigation.
- skip unavailable `lr-thread-list` rows locally and across virtual-window keyboard boundaries.
- preserve `lr-prompt-queue` focus when a controlled removal is accepted.
- enforce `lr-push-to-talk`'s hit floor and keep custom trigger glyphs decorative.
- preserve `lr-sequence-strip` and `lr-heatmap` roving focus through controlled refreshes, and honor the strip's host name.
- preserve `lr-graph-query-builder` focus when filter chips or saved queries are removed.
- transfer `lr-realtime-session` focus when its public capture surface is hidden.
