---
"@aceshooting/lyra-ui": patch
---

`<lr-flag>` now distinguishes a peer that is not installed from one that is installed but does not
carry the capability the chosen entry point needs.

Both cases previously produced the same warning — "install it with `pnpm add
@aceshooting/lyra-flags`" — which is advice a reader in the second case has already followed, and
which sends them looking for the wrong problem entirely.

That case stops being exotic from this release on. `flag-peer-bulk-standard.js` requires
`createFlagUrlResolver()` on the tier-committed `./standard` subpath, which older peers do not
export at all, so a consumer who upgrades `@aceshooting/lyra-ui` while pinning
`@aceshooting/lyra-flags` reaches it by the ordinary route. The peer-range floor moves in the same
release to make that a resolution warning rather than a silent one, and this makes the runtime
message match: it now says the package is present, that this is a version mismatch, and where to
look for the floor it expects.
