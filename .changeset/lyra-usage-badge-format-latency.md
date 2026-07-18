---
"@aceshooting/lyra-ui": minor
---

`lyra-usage-badge` gains `formatLatency?: (ms: number) => string`, overriding the built-in duration
algorithm (which has no minutes/hours tier — `'{ms}ms'`, or one-decimal seconds above 1000ms) in
both the visible strip and the tooltip row. Mirrors `lyra-activity-feed`'s `formatTimestamp`
convention. Previously a consumer whose latencies commonly exceed a minute (e.g. a long-running
agent run) had no way to render its own duration scale instead of a bare seconds count.
