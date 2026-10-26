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

The seven-sample quick Chromium comparison with 30.2.0 recorded eight advisory timing regressions
across table assignment, chart assignment and combobox metadata. Table update median increased
from 5.9 to 7.4 ms, while total median decreased from 28.1 to 27.7 ms; total p95 increased from
28.5 to 41.4 ms. The affected module closures and theme bytes are unchanged, and functional
assertions and bounded-work counts pass. Phase redistribution and isolated slow samples contribute
to these observations; their cause remains unresolved, so no runtime speedup is claimed.
