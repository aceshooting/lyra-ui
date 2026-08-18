---
"@aceshooting/lyra-ui": patch
---

Fix three defects found while auditing test coverage:

- `<lr-chat-message>`: with `actions-position="outside"`, the slotted actions row is a sibling of
  the bubble rather than a flex item nested inside the footer, so the footer's role-conditional
  auto-margin alignment became a no-op (a box that already fills its container has no spare space
  for `auto` margins to distribute). A user turn's actions stayed pinned to the inline-start edge
  instead of aligning to the inline-end edge next to its own right-aligned bubble. Now aligned via
  `justify-content` on the actions row itself.
- `<lr-file-input>`: the dropzone collapsed to its own intrinsic content height instead of filling
  a host given a definite block size (e.g. absolutely positioned with `inset: 0` over a sized
  panel) — none of `[part="form-control"]`, `.dropzone`, or `[part~="base"]` propagated the host's
  height down the chain.
- `<lr-chart>`: a chart whose row count exceeded the 1,000-record rendering budget but whose series
  count did not got its shared `labels` array correctly sampled down, but each series' own
  `data`/`color`/`pointRadius`/`pointColors`/`segmentColors` arrays stayed at full source length —
  a length mismatch handed straight to Chart.js. Row sampling now applies to every series
  regardless of whether the series dimension itself also needed sampling.
