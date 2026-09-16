---
"@aceshooting/lyra-ui": patch
---

Fixed `<lr-confirm-bar>`'s `returnFocusTo` thunk resolving before a reactive host could re-create
the control it names. The documented motivating case -- a host that conditionally swaps a focused
trigger out for this bar, then swaps a brand-new trigger back in once a decision lands -- could
never work: every supported host framework re-renders asynchronously relative to the bar's own
synchronous focus handoff, so the thunk's first (and, previously, only) call always found the
replacement control missing and fell back past `[part="status"]` to `<body>` once the host's own
re-render removed the bar.

When the thunk's immediate resolution fails, the handoff now retries once more after the host has
had a real chance to react, and moves focus there only if it has since appeared, is connected and
focusable, and nothing else has claimed focus in the meantime. An immediately-resolving thunk or a
plain element value is unaffected -- resolved once, synchronously, exactly as before.

The retry is a new shared primitive, `deferComposedFocusRepair()` (plus its `nextHostUpdateOpportunity()`
timing helper), in `src/internal/focus-navigation.ts`, built on the existing
`captureComposedFocusRepair()`/`applyComposedFocusRepair()` pair so any other component with the same
shape -- a return-focus thunk naming a control its host re-creates asynchronously -- can adopt it
directly.
