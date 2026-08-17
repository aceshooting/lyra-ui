---
"@aceshooting/lyra-ui": patch
---

Fix the same `overflow-wrap: anywhere` mid-word-break defect already fixed across seven other
components (see the `overflow-wrap-anywhere-sibling-components` and `switch-label-break-word`
changesets) in `<lr-card>` too — a straggler that remediation pass missed. Both `[part="body"]`
and a slotted `[slot="header"]` collapsed their min-content contribution to near nothing while
sitting as a flex item next to a non-shrinking sibling, splitting an ordinary short word mid-
syllable instead of wrapping at the space before it. `overflow-wrap: break-word` gives the
identical last-resort rescue for a genuinely unbreakable long token without that regression.
