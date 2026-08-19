---
"@aceshooting/lyra-ui": patch
---

`<lr-flag>` now warns once in the console when `country`/`language` is set but no flag resolver has
been registered, naming the offending code and the `flag-peer.js` import that fixes it. Previously
this failed to the visible `[part="error"]` state in complete silence, which is indistinguishable
from missing flag data — the resolver is deliberately absent from the core component's module
graph, so an unimported peer entry is the single likeliest cause and was the hardest to diagnose.
The warning is emitted once per resolver-registration generation, so a page of many flags does not
repeat it. An already-resolved `src`, a registered resolver, and a well-formed-but-unmapped code
(which is data, not a defect) all stay silent.
