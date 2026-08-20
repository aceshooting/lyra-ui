---
"@aceshooting/lyra-ui": patch
---

Added `flag-peer-bulk.js` (and the new `flag-peer-bulk-standard.js`) to `package.json`'s
`sideEffects` list.

These modules exist purely for their import-time side effect: a consumer writes a bare
`import '…/flag-peer-bulk.js'` and never reads an export, so a bundler honouring `sideEffects` drops
the module outright unless it is declared. The generator that derives these entries matched the bare
suffix `-peer.ts` but not the qualified `-peer-bulk.ts` — the same blind spot that left the module
out of the `exports` map.

This half failed more quietly than that one. The missing export route was a hard build error; a
missing `sideEffects` entry compiles cleanly and then simply does nothing in a production build, so
`<lr-flag>` would fall back to no resolver with no diagnostic at all.
