---
"@aceshooting/lyra-ui": minor
---

Add explicit widget registry and binding-state passthrough to message parts, preserve widget
identity during sibling text updates, and load non-text part renderers on demand. Correct the
structural A2UI-like helper's binding-state result and extend AG-UI reasoning/activity/custom
mapping with host-controlled custom-event destinations.

Add an opt-in official MCP Apps host transport with negotiated capabilities, bounded requests,
resource policy, cancellation and teardown alongside the existing default bridge. Incremental
text-delta accounting preserves untouched payload identities and handles UTF-8 surrogate joins
without repeatedly scanning retained message data. Support and qualification boundaries are
documented with the corresponding APIs.
