---
"@aceshooting/lyra-ui": patch
---

`<lr-memory-panel>` no longer strands keyboard focus when a row action opens its confirmation step.
Activating "Add to long-term memory", "Remove", or "Forget all" destroys the button that had focus,
and nothing moved focus into the `lr-confirm-bar` that replaces it, so focus fell back to `<body>`:
a keyboard user was dumped at the top of the page with nothing announced, and had to re-tab through
the whole document to reach the confirmation they had just opened. Focus now moves into the
confirmation (its Deny control -- the safe action -- falling back to the bar's status element), and
is handed back to the row (or to the "Forget all" control) once the decision resolves. Pressing
Escape while the confirmation holds focus now cancels it exactly like pressing Deny: no event is
emitted, focus returns the same way, and the key does not propagate past the panel.
