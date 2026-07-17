---
"@aceshooting/lyra-ui": minor
---

Add `lyra-span-waterfall`: the horizontal-timeline projection of the same `LyraSpan[]`
`lyra-trace-tree` consumes — a time axis, one row per span in start order, and status-toned,
keyboard-navigable bars (Langfuse timeline / Temporal event-history style). Declarative
`viewStartMs`/`viewEndMs` window props (composable with `lyra-time-range` as a brush) stand in for
zoom/pan gestures this round. Both components emit the same `lyra-span-select { id }` and accept
the same `activeSpanId`, so a host syncs selection between them with two listeners and one property
binding.
