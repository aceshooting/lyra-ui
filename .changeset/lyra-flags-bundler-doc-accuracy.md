---
"@aceshooting/lyra-flags": minor
---

Corrects the README and inline JSDoc's description of `flagUrl()`/`flagUrls()`'s code-splitting
behavior: earlier wording claimed a production bundler ships only the specific flags an app
references (e.g. "referencing 2 codes shipped ~28 KB total, not all 249"). That's true of what the
*browser fetches at runtime*, but a bundler may still emit the complete reachable lazy-chunk graph
at build time since every supported code has a literal loader import. Docs now recommend a literal
`@aceshooting/lyra-flags/flags/<code>.svg` subpath import (or copying only the required assets)
when the deployment artifact itself must be pruned to a small allowlist. No runtime behavior
change. Also refreshes package metadata (`keywords`, `homepage`, `packageManager`, `svgo`
devDependency).
