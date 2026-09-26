---
'@aceshooting/lyra-ui': major
---

**Major because a previously-working default activation path is removed.** The `focus` trigger of
`lr-tooltip` (default `hover focus`), `lr-popover` and `lr-dropdown`, and the hover/focus surfaces
of `lr-copy-button`, `lr-app-rail-item`, `lr-usage-badge`, `lr-tool-call-chip`, `lr-citation-badge`
and `lr-entity-chip`, now open only on keyboard focus: the focused control must match
`:focus-visible` and no pointer press may have preceded it. Pointer, touch and scripted focus that
follows them — such as a drawer moving focus to its close button after a tap, or an application
calling `.focus()` on a trigger from script — no longer pops a surface. Focus from any source still
gives `lr-tooltip`, `lr-copy-button`, `lr-usage-badge` and `lr-tool-call-chip` triggers their
accessible description while focus stays on them. A pointer click that opens a closed hover- or
focus-mode `lr-popover`/`lr-dropdown` now always opens it pinned like click mode, including
`[autofocus]` and menu focus. A direct tap still opens hover surfaces through the browser's
compatibility `mouseenter`.

**Migration**

- `lr-tooltip`, `lr-popover`, `lr-dropdown`: any code that relied on a programmatic `.focus()` call
  (or synthetic `focus` event) to reveal one of these must call `show()` (or set `.open = true`)
  instead — that public scripted-reveal API is unaffected by this change.
- `lr-copy-button`, `lr-app-rail-item`, `lr-usage-badge`, `lr-tool-call-chip`, `lr-citation-badge`,
  `lr-entity-chip`: their hover/focus preview has no public scripted-reveal method, so there is no
  like-for-like replacement for a previously-relied-upon programmatic-focus preview — this is a
  deliberate accessibility narrowing (WAI-ARIA tooltip pattern), not a renamed API. The accessible
  description/name these components attach on focus is unaffected; only the *visible preview
  surface* stops following non-keyboard focus.
- Tests that open any of the above surfaces with `.focus()` or a synthetic `focus` event should
  move focus with a real Tab key (see `test/wtr-focus.ts`'s `focusByKeyboard`) or, for
  `lr-tooltip`/`lr-popover`/`lr-dropdown`, call `show()` directly.
