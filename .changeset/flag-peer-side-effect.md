---
"@aceshooting/lyra-ui": patch
---

Declare `flag-peer.js` in `package.json#sideEffects`, so `<lr-flag>` still resolves images in a
production build. `sideEffects` is an explicit allowlist, and every entry in it was derived from a
`*.class.ts` file's sibling registration module. `flag-peer.ts` has no `*.class.ts` of its own, so
neither the generator nor the completeness check ever visited it and it shipped undeclared. It is a
side-effect-only module — a consumer writes a bare `import '.../flag-peer.js'` and reads no export
— so any bundler honoring `sideEffects` dropped it outright. `setFlagUrlResolver()` then never ran,
`loadFlagUrlResolver()` cached `Promise.resolve(null)`, and every `<lr-flag>` given a
`country`/`language` rendered the localized "flag unavailable" alert instead of an image. Silently:
that null-resolver path logs nothing, and dev servers don't tree-shake, so it only ever appeared in
a built artifact.

Both scripts now derive `*-peer.ts` and `*-register.ts` modules, plus the per-family
`components/<family>/index.ts` barrels, straight from the file tree rather than carrying them over
from the previous `package.json` — so a rename or a family move can't strand an entry again. The
completeness check fails on the missing `flag-peer` entries before the fix and passes after.
