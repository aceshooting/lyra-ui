---
"@aceshooting/lyra-ui": minor
---

Add `lyra-trace-tree`: a collapsible span hierarchy for one agent/LLM trace (Langfuse/LangSmith
run-tree style) — kind icon, name, status, an inline duration bar on the shared trace time scale,
and optional tokens/cost columns. Consumes a flat `LyraSpan[]` array (hierarchy derived from
`parentId`); expand state survives a streaming reassignment of `spans`. The shared `LyraSpan` type
(`components/trace-tree/span.ts`) is also consumed by the upcoming `lyra-span-waterfall`, so the
two components can render the same trace as two synchronized projections.
