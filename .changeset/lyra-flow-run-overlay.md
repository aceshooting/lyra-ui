---
"@aceshooting/lyra-ui": minor
---

Adds `<lyra-flow-run-overlay>`: execution-state presentation for `lyra-flow-canvas` — mirrors a
`FlowRunDecorations` map into the resolved canvas (which owns the actual node/edge paint) and
renders a compact "{done} of {total} steps complete" summary strip with per-status counts.
Status transitions announce through a throttled live region. Pure pushed state — no execution,
polling, or internal clock.
