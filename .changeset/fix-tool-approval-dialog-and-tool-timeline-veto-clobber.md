---
"@aceshooting/lyra-ui": patch
---

Two bug fixes across `<lr-tool-approval-dialog>` and `<lr-tool-timeline>`, mirroring the veto-clobber
fix already shipped for `<lr-confirm-bar>`.

- `<lr-tool-approval-dialog>`: `onApprove`/`onDeny` dispatched the cancelable `lr-approve`/`lr-deny`
  event synchronously, then unconditionally overwrote `.pending` with their own built-in value —
  silently clobbering a synchronous listener that had called `preventDefault()` and then resolved
  the decision itself (by calling `close('approve'|'deny')` or setting `.pending` directly) instead
  of waiting for the built-in pending/loading presentation. Unlike `<lr-confirm-bar>`, nothing else
  in this component reconciled the stuck value afterwards. That listener's own state now wins: the
  built-in `pending` fallback only applies when the listener left both `.pending` and `.open`
  untouched.
- `<lr-tool-timeline>`: `onDialogApprove`/`onDialogDeny` unconditionally set the private
  `approvalPending` state whenever a host canceled the wrapper `lr-tool-approval-decide` event, even
  when the host had already resolved the entry synchronously by reassigning `entries` (the documented
  alternative to calling `finalizePendingApproval()`/`revertPendingApproval()`) from inside that same
  listener. The stale pending flag left the shared `<lr-tool-approval-dialog>` showing a pending
  spinner over an already-resolved entry. The entry's live state is now re-checked immediately after
  dispatch, directly against the current `entries`, so a pending flag is never set or kept for an
  entry that no longer needs a decision.
