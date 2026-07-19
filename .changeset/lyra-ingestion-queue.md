---
"@aceshooting/lyra-ui": minor
---

New `<lr-ingestion-queue>` component: a controlled list of documents moving through an ingestion
pipeline (`queued` → `uploading` → `extracting` → `chunking` → `embedding` → `indexing`, plus the
terminal `done`/`failed`/`cancelled` stages), each row composing `lr-badge` for its stage label,
`lr-progress-bar` for in-flight progress, and chunk-count/embedding-status/attempt-count text.
`lr-empty` renders the zero-items state. Presentation only -- this component runs no ingestion
itself and never mutates `items`; retrying a `failed` row or cancelling any non-terminal row fires
a controlled `lr-retry`/`lr-cancel` request event (`detail` extends the shared `RetryEventDetail`/
`CancelEventDetail` from `src/ai/types.ts` with the `itemId` identifying which row) and waits for
the host to supply an updated `items` array, the same request/response convention
`<lr-thread-list>`'s row-action events already establish. At or above `virtualizeThreshold` items
the list renders through an internal `<lr-virtual-list>` instead of a plain keyed list, matching
`<lr-thread-list>`'s data mode and `<lr-activity-feed>`'s own `virtualizeThreshold` precedent.
