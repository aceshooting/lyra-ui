---
"@aceshooting/lyra-ui": minor
---

Adds `<lyra-confirm-bar>`: an inline, non-modal approve/deny block for one proposed action — the
in-flow sibling of `lyra-tool-approval-dialog` for confirmations that belong in the transcript instead
of an overlay. Same `lyra-approve`/`lyra-deny` event shapes and the same heading/args-label/deny/approve
localization keys as the dialog, so the two stay in lockstep. No focus trap, scroll lock, or
Escape/backdrop handling; on activation, focus moves synchronously to the always-present decided-state
text before the Deny/Approve buttons unmount, and an internal live region announces the outcome.
