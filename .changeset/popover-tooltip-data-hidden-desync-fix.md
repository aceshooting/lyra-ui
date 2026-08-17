---
"@aceshooting/lyra-ui": patch
---

Fix `<lr-popover>` and `<lr-tooltip>` getting stuck visible and interactive after closing.

Both components drove their popup's `data-hidden` attribute through a Lit declarative template
binding *and* an imperative direct DOM write to the same attribute, keyed off a plain
non-reactive private field (`anchorPositioned`). The imperative write silently desynced Lit's own
dirty-check cache for that attribute part; because neither component's `updated()` lifecycle hook
repositions on close (only while `open`), a later close transition could evaluate the same
boolean expression to a value matching Lit's stale cache and skip the DOM write entirely — leaving
the popup visually and interactively present (`pointer-events: auto`) after every dismissal route
(trigger click, outside click, Escape, `.hide()`) once it had opened once. `anchorPositioned` is
now a real reactive `@state()` property in both classes, and the redundant imperative writes are
removed, making Lit's own render cycle the single source of truth for the attribute.
