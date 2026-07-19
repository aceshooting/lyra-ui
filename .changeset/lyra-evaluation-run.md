---
"@aceshooting/lyra-ui": minor
---

New `<lr-evaluation-run>` component: an evaluation batch's live progress. An overall
`<lr-progress-bar>` counts terminal (done/error/cancelled) examples against the batch's `total`
(or `examples.length` when unset), with running/failed count badges alongside it. Each example
renders as its own `<lr-details>` disclosure showing input/output via `<lr-markdown>` or
`<lr-code-block>` (per `inputFormat`/`outputFormat`), a composed `<lr-grounding-summary>` when the
example carries a `GroundingAssessment` (plus optional evidence `citations`), and a composed
`<lr-tool-timeline>` when it carries `toolTrace` entries -- this component defines no grounding-
scoring or tool-call rendering of its own. `status` reuses the shared `AgentStatus` contract from
`@aceshooting/lyra-ui/ai/types`, the same run-lifecycle vocabulary an agent step already uses.
Nested `<lr-grounding-summary>`/`<lr-tool-timeline>` selection and approval events are intercepted
and re-emitted as this component's own `lr-example-citation-select`/
`lr-example-tool-approval-decide`, correlated with the originating example's `id` so a host never
needs to walk the DOM to find out which example a nested interaction came from. Per-example
disclosure toggling fires `lr-example-toggle`. A live region announces per-example status
transitions (started/completed/failed/cancelled/needs input/needs approval), gated so a freshly-
mounted run never announces its initial statuses.
