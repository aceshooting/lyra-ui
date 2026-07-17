---
"@aceshooting/lyra-ui": minor
---

Adds `<lyra-task-list>`: a live, collapsible tracker for an agent's plan, embedded in the
transcript. Renders ordered steps with per-step lifecycle status (`pending`/`running`/`success`/
`error`) and one level of nested sub-steps; status changes are announced through an internal
throttled live region. A dynamic `detail-<id>` slot per item accepts rich content such as a
`<lyra-tool-call-chip>`. Unlike `<lyra-stepper>` (a single-selection navigation control),
`<lyra-task-list>` is a read-only status report — several steps may be `running` at once, and
there is no selection.
