---
"@aceshooting/lyra-ui": patch
---

`installHappyDomFormAssociatedShims()` no longer throws a `ReferenceError` when `HTMLElement` isn't a global at all — e.g. a plain Node Vitest environment sharing one `setupFiles` entry with happy-dom/jsdom test files. It previously read `HTMLElement.prototype` unconditionally, contradicting its own documented "safe to call unconditionally from a shared setup file used across multiple test environments" contract.
