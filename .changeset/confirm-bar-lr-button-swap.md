---
"@aceshooting/lyra-ui": minor
---

`lr-confirm-bar`: swap the hand-rolled `deny-button`/`approve-button` native `<button>`s for
`<lr-button>`, so `--lr-button-*` theming and a consumer's existing `lr-button` style fragments
reach them like every other button in an app. Adds a host-writable
`pending: 'approved' | 'denied' | null` property and makes `lr-approve`/`lr-deny` cancelable: a
listener calling `preventDefault()` sets `pending` to the decision being made (showing `loading`
on that button, `disabled` on the other) instead of resolving synchronously, so a host whose
approval hits a network call can keep the UI honest about being in flight. Finalize by setting
`.decision`, or bounce back by clearing `.pending` to `null`.

**Breaking (CSS only):** `::part(deny-button)`/`::part(approve-button)` now select an `<lr-button>`
host, not a native `<button>`.

Before:
  lr-confirm-bar::part(deny-button) { padding: 4px 8px; border: ...; }
After (use the re-exported sub-parts):
  lr-confirm-bar::part(deny-button-base) { padding: 4px 8px; border: ...; }

Runtime API (events, `tone`, `compact`, slots, the new `pending` property) is unchanged.
