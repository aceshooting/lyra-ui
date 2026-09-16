---
"@aceshooting/lyra-ui": patch
---

`<lr-input>`'s and `<lr-textarea>`'s `debounce` no longer silently stops working under the
controlled-input pattern. A pending `lr-input-settled` was cancelled by any programmatic `value`
write, including the one every framework binding makes on each render when it writes the just-typed
value straight back, so the event simply never fired and nothing warned. Only a write that actually
changes the value now cancels the pending settle; a write of the value already held leaves it
pending. A genuinely different value still supersedes the in-flight edit, exactly as before.

The fix lives in the shared `DebounceController` (a new `cancelIfChanged()`), so every debounced
control that routes external writes through it gets the same contract.
