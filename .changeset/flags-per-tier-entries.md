---
"@aceshooting/lyra-flags": minor
---

Added `./standard`, `./compact`, and `./detailed` package entry points, each exporting a
tier-committed `flagUrl(code)` with the same shape as the package root's, minus `options.variant`.
The root's `flagUrl()` statically imports all three tiers' generated loader maps so it can honour a
per-call `variant`, so a bundler may include all three tiers' reachable chunks even when an app only
ever requests one fidelity. A consumer whose whole app is pinned to one `fidelity` (no per-instance
switching) can import the matching entry instead — `./standard` imports only `flags/generated.js`;
`./compact`/`./detailed` add only their own tier's generated map, never the other's — excluding the
unused tier(s) from the reachable graph. Register one with `<lr-flag>`'s `setFlagUrlResolver()`
instead of importing `flag-peer.js` (which always registers the full three-tier resolver).
