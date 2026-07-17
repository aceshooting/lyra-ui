---
"@aceshooting/lyra-ui": minor
---

Adds `<lyra-checkpoint>`: an inline conversation restore point — a labeled marker between messages
whose Restore affordance confirms inline (an accessible-name-carrying button swap, focus-managed,
Escape/focus-out-aware) before firing a `lyra-restore { checkpointId, label }` event. Persists and
restores nothing itself — host state in, events out. `confirmRestore="false"` skips the inline
confirm step entirely; `restorable="false"` renders a plain, non-interactive marker for read-only
views or the currently-restored point.
