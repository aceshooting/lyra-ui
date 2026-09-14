---
"@aceshooting/lyra-ui": minor
---

`<lr-textarea>`, `<lr-code-block>`/`<lr-code-block-core>`, `<lr-dialog>`, and `<lr-details>` now
fill a definite-height container instead of collapsing to their own content-sized default,
following the library's established unconditional `block-size: 100%` chain (see
`<lr-file-input>`/`<lr-code-editor>`). Every chain link is a plain percentage against its own
parent, which resolves to `auto` — a no-op — for the ordinary content-sized case, so an unsized
instance of any of these renders exactly as before.

- `<lr-textarea>`: the chain now runs `:host` → `form-control` (a flex column, so `label`/`hint`/
  `error`/`footer` keep their natural size) → `base`/`form-control-input`/`textarea-adjuster`/
  `textarea-wrapper` → the native `textarea`, without disturbing `resize="auto"`'s own JS-driven
  growth or its `--lr-textarea-max-block-size` cap.
- `<lr-code-block>`/`<lr-code-block-core>`: `base` is now a flex column and `body` grows to fill
  it, still capped by `--lr-code-block-max-height` and still scrollable.
- `<lr-dialog>`: `body` now grows to fill whatever block space `panel` has left once `header`/
  `footer` take their own natural size, giving slotted content a definite, scrollable size. New
  `--lr-dialog-height` custom property (default `auto`, always capped at the viewport like
  `--lr-dialog-width`) opts into an assertive panel height instead of only the existing
  content-sized default.
- `<lr-details>`: the previously-unstyled internal content gate between `base` and `content` now
  continues the fill chain, so open panel content can fill and scroll inside a bounded host without
  disturbing the closed/`until-found` findable state or the disclosure's open/close lifecycle.
