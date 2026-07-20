---
"@aceshooting/lyra-ui": minor
---

`lr-tool-approval-dialog`: swap the hand-rolled `deny-button`/`approve-button` native `<button>`s
for `<lr-button>` (`variant="neutral"`/`"brand"`), so `--lr-button-*` theming and a consumer's
existing `lr-button` style fragments reach them like every other button in an app. Adds a
host-writable `pending: 'approve' | 'deny' | null` property and makes `lr-approve`/`lr-deny`
cancelable: a listener calling `preventDefault()` sets `pending` to the decision being made
(showing `loading` on that button, `disabled` on the other) instead of closing immediately, so a
host whose approval hits a network call can keep the dialog honest about being in flight.
Finalize by calling `close('approve'|'deny')`, or bounce back by clearing `.pending` to `null`.
While `pending` is set, Escape and backdrop dismissal are suppressed; `pending` itself resets to
`null` every time the dialog re-opens. The `edit-button` is unaffected.

**Breaking (CSS only):** `::part(deny-button)`/`::part(approve-button)` now select an `<lr-button>`
host, not a native `<button>`.

Before:
  lr-tool-approval-dialog::part(deny-button) { padding: 4px 8px; border: ...; }
After (use the re-exported sub-parts):
  lr-tool-approval-dialog::part(deny-button-base) { padding: 4px 8px; border: ...; }

Runtime API (events, `editable` and its editing behavior, slots, the new `pending` property) is
unchanged.
