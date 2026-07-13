---
"@aceshooting/lyra-ui": minor
---

`lyra-stepper`'s `StepItem` gains an optional `title` field, rendered as a native `title` tooltip on
that step's button — useful for explaining why a `disabled` step is locked (e.g. "Complete Basics
first"). Steps that omit it render no `title` attribute at all, unchanged from today.
