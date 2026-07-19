---
"@aceshooting/lyra-ui": minor
---

New `<lr-memory-panel>` component: an agent's working memory surface -- short-term context and
long-term memories, each item's confidence and optional grounding provenance, and add/remove/forget
actions gated behind an explicit confirmation step. Composes `<lr-provenance-panel>` for a per-item
provenance breakdown (behind a disclosure toggle, only rendered when an item defines one) and
`<lr-confirm-bar>` for every add/remove/forget confirmation, reusing this repo's existing inline
confirmation pattern rather than inventing a new one. A memory item's confidence reuses
`<lr-citation-badge>`'s own confidence vocabulary, tiered against `thresholds` the same way
`<lr-chunk-inspector>` tiers a chunk's relevance score. `shortTerm`/`longTerm` are controlled and
never mutated by the component -- approving a pending action only fires the matching `lr-add` /
`lr-remove` / `lr-forget` event; the host applies the resulting state change.
