---
"@aceshooting/lyra-ui": minor
---

New `<lr-retrieval-trace>` component: a retrieval pipeline's stage timeline (query rewriting,
embedding, retrieval, reranking, filtering), rendered through `<lr-span-waterfall>`'s existing
time-scaled bar rendering rather than a new timeline widget -- each `RetrievalStage` projects to
one `LyraSpan`, with `kind` mapped onto whichever existing `LyraSpan['kind']` fits best (`embed`
-> `'embedding'`, `retrieve` -> `'retriever'`, `query-rewrite` -> `'llm'`, `rerank`/`filter` ->
`'tool'`). Below the timeline, a disclosure list exposes each stage's expandable evidence panel:
free-form text, retrieved/reranked/filtered chunks via a compact `<lr-chunk-inspector>` (`chunks`
accepts `RetrievalChunk` from `@aceshooting/lyra-ui/ai/types` directly), and/or arbitrary stage
metadata as a key/value list. Controlled `stages`/`activeStageId` properties; emits `lr-stage-select`
and `lr-stage-toggle`. Never fetches, ranks, or computes retrieval results itself.
