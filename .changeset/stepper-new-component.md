---
"@aceshooting/lyra-ui": minor
---

Add `lyra-stepper`: ordered multi-step wizard navigation (label + index, current/completed/
locked/error state, click-to-jump, horizontal/vertical orientation). Fully data-driven and
controlled -- like `lyra-table`, it never mutates its own `steps` data, firing a cancelable
`lyra-step-select` event and leaving state updates to the host, so gating a jump behind an
external validity check (e.g. "does the target step's data exist yet") is a normal listener, not a
workaround.
