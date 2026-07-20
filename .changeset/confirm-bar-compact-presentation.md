---
"@aceshooting/lyra-ui": minor
---

`lr-confirm-bar`: new reflected `compact` property that collapses the bar from a full card
(bordered, padded, `display: block` surface) into a chrome-less inline row, for a confirmation that
has to live inside an existing container — a table cell, a card's action row, a toolbar.

- The **host** flips to `inline-flex` under `[compact]`, not just `[part='base']`: restyling the
  part alone still leaves a `display: block` host that breaks the row it was dropped into.
- The narrow-allocation container query is switched off with it (`container-type: normal`). A
  compact bar is *expected* to be narrow, so leaving the query live would fire it essentially
  always and stretch the Deny/Approve buttons to fill — the opposite of the intent.
- Re-chrome it through `--lr-confirm-bar-compact-padding` (default `0`),
  `--lr-confirm-bar-compact-gap` (default `var(--lr-space-s)`), `--lr-confirm-bar-compact-border`
  (default `none`), `--lr-confirm-bar-compact-radius` (default `0`) and
  `--lr-confirm-bar-compact-background` (default `transparent`).
- Everything else is unchanged: `lr-approve`/`lr-deny` shapes, `role="group"` and its heading
  label, and the contract that focus moves synchronously to `[part='status']` *before* the
  Deny/Approve buttons unmount. Leaving `compact` unset renders exactly as before.
