---
"@aceshooting/lyra-ui": minor
---

Fix `lr-notebook-viewer`'s cell and output styling never applying, and make every cell-level part
reachable from a consumer stylesheet.

Cells are composed through `lr-virtual-list`, whose `renderItem` result is committed inside that
element's **own** shadow root — one boundary below the viewer's. A bare `[part='cell']` selector in
the viewer's stylesheet cannot cross that boundary, so the rules for `cell`, `cell-gutter`,
`outputs`, `output` and `output-toggle` were all silently inert: cells rendered without their
two-column grid, padding and separator, the execution-count gutter without its monospace/quiet
treatment, stderr and error outputs untinted, and the show-all-output control as a raw browser
button. Every one of those rules now goes through `lr-virtual-list::part(…)`, including the
narrow-allocation `@container` block — container queries resolve through the flat tree, so they
still evaluate against the viewer's own `:host` container across the shadow boundary.

`::part()` cannot be followed by an attribute selector or a descendant combinator, so three states
and one descendant get their own part names, added alongside the existing ones as a part list
(`::part()` carries `part~=` semantics, so both names match the same element):

- **New:** `cell-active` — the cell an anchor currently targets. This is what
  `--lr-notebook-viewer-active-bg` retints; that custom property had no effect until now.
- **New:** `output-error` — a stderr stream or an error output, carrying the danger tint.
- **New:** `error-output-label` — the label introducing an error output's traceback.

The `data-active`, `data-stream` and `data-output-type` attributes are unchanged and still describe
each element for scripting.

The viewer forwards `cell`, `cell-active`, `cell-gutter`, `cell-source`, `outputs`, `output`,
`output-error`, `error-output-label` and `output-toggle` through `exportparts`, so
`lr-notebook-viewer::part(cell)` and friends work from a consumer stylesheet for the first time.
