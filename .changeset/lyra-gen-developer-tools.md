---
"@aceshooting/lyra-gen": minor
---

Developer tools for building generated dashboards without a backend or a model: `mock-data.js` derives deterministic, bound-respecting sample JSON from a catalog (`mockQueryResult()`, `mockLiveData()` and `createMockQueryProvider()` for `lr-gen-view.queryProvider`), `telemetry.js` adds dependency-free OpenTelemetry-shaped spans and counters for parse, validate, preview, repair and render phases plus `observeGenView()` and `recordUsage()` that never report state values, prompts or user text, and `lyra-gen init [dir]` scaffolds a static starter host that streams a canned dashboard with mock data and refuses to overwrite existing files.
