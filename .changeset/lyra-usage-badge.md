---
"@aceshooting/lyra-ui": minor
---

Adds `<lyra-usage-badge>`: a compact, static resource strip for one message or run — tokens in/out,
cost, latency — with a hover/focus tooltip breakdown (full grouped figures, plus a computed Total
tokens row when both counts are set). Purely formatting: it computes no counts, rates, or prices,
and every segment is independently optional. Reuses `<lyra-tool-call-chip>`'s hover/focus/Escape
tooltip contract. Distinct from `<lyra-context-meter>` (occupancy of a fixed capacity) and
`<lyra-generation-status>` (a live ticking readout with a Stop button) — this is the static spend
record shown after a message or run completes.
