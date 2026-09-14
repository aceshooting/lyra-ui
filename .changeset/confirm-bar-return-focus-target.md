---
"@aceshooting/lyra-ui": minor
---

`<lr-confirm-bar>` can now be told where focus belongs after a decision, and `<lr-checkpoint>` no
longer drops focus when a host starts restoring.

- `<lr-confirm-bar>` gains `returnFocusTo`, an optional property (an `HTMLElement`, `null`, or a
  thunk resolving to one) naming where focus should go once a decision lands. Until now the bar's
  only focus destination was its own `[part="status"]` — correct as a landing spot that cannot
  disappear mid-handoff, but a dead end for the case the component exists for: a host swaps a
  focused control out for the bar, and once the decision is made focus belongs back on that control,
  not on a status line the host is about to unmount. It applies to every path that reaches a
  decision, including a `pending` decision finalized externally. A named target that is missing,
  detached, `inert`, or otherwise refuses focus falls back to `[part="status"]` rather than to
  `<body>` — an `inert` element refuses `focus()` silently. Left unset (the default), the handoff is
  byte-identical to today's.
- `<lr-checkpoint>`: confirming a restore now refocuses `[part="restore-button"]` even when the host
  sets `restoring` from its own `lr-restore` listener. Confirming destroys the confirm group and with
  it the Confirm button holding focus, and the previous guard declined the refocus whenever a restore
  had already started — dropping keyboard users onto `<body>` at the moment the operation they
  authorized began. The restore button is still rendered in that state (`aria-disabled`, not
  `disabled`), so it was focusable the whole time.
