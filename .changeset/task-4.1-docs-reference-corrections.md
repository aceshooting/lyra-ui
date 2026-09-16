---
"@aceshooting/lyra-ui": patch
---

Fixed dangling cross-references in the generated per-component reference
(`llms/components/<tag>.md`): a "see the ... note above" (or "this file's ... section") pointer
only resolves while reading the whole family file, and is lost once a component's own section is
split into its self-contained page. `<lr-stepper>`'s "picking a basis" gotcha now inlines the full
explanation and worked example that previously lived only under `<lr-multi-split>`'s own section,
and `<lr-knowledge-graph-explorer>`'s `nodes`/`links`/`fitTo`/`nodeLabels`/hull-color entries now
link straight to `<lr-graph>`'s own published reference instead of pointing at "this file"'s
`lr-graph` section, which the split reference page never contains. The generator now also fails
the build on a future positional "above"/"below" reference, or a future "this file's `<tag>` ...
section" reference, that would dangle the same way once split.

Added a target-filtering note to `<lr-drawer>`'s own `@event lr-close` JSDoc, matching
`<lr-dialog>`'s: the name is not drawer-scoped, so a listener bound on `<lr-drawer>` should guard
on `event.target` before reading a descendant's close.

Published the `--lr-theme-form-control-height-2xs`…`-xl` tier to the design-token reference
alongside the existing `--lr-theme-form-control-radius` entry, matching the shipped CSS these
override hooks already control.
