---
"@aceshooting/lyra-flags": minor
---

`createFlagUrlResolver()` is now exported from `@aceshooting/lyra-flags/standard`, not only from the
package root.

2.1.0 shipped two things that solved two different problems and could not be used together. The
tier-committed entry points (`./standard`, `./compact`, `./detailed`) import only their own generated
loader map, which is what closes the "importing the peer at all makes the whole three-tier lazy-chunk
graph reachable" problem. But each exported only `flagUrl` and its tier's `FLAG_LOADERS`;
`createFlagUrlResolver()` lived solely on the root, which statically imports all three tiers' maps so
the root `flagUrl()` can honour a per-call `variant`. Taking the bulk path therefore meant reaching
back through the root and re-acquiring exactly the cost the per-tier entries exist to avoid.

The three-tier import was never needed for the bulk path: `flagUrls()` reads `flags/eager.js`, which
is standard-tier-only by construction — `createFlagUrlResolver()`'s own doc comment says so. The
coupling was inherited purely from sharing a module with the variant-aware `flagUrl()`.

A consumer measured the difference on a real 12-route production build with a 156-country flag
column, swapping only the resolver registration: 10,168,801 bytes of assets via `./standard` against
25,983,335 bytes via the root — +15.8 MB of flag assets no route renders (+65 SVGs, the whole
detailed tier; +31 WebPs, the whole compact tier). The bulk path's real win, 344 JS chunks collapsing
to 226 as the per-code loader chunks become one eager map, was completely swamped by it.

`@aceshooting/lyra-ui` gains a matching `flag-peer-bulk-standard.js` registration entry, so a
tier-committed consumer can take the bulk path without re-reaching the root.
