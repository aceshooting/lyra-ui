---
'@aceshooting/lyra-ui': minor
---

`lr-step` adds `customStates` (attribute `custom-states`): a space-separated list of author-defined
state names, each published as a CSS custom state, so `<lr-step custom-states="error">` can be styled
with `lr-step:state(error)::part(marker)`. Names must be CSS identifiers; the step's own states
(`active`, `completed`, `loading`, `disabled`, `locked`, `clickable`) cannot be overridden. The names
are a styling hook only and change neither the status text nor the stepper's behavior.
