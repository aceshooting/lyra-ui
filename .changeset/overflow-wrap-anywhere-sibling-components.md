---
"@aceshooting/lyra-ui": patch
---

Fix the same `overflow-wrap: anywhere` mid-word-break defect just fixed in `<lr-switch>` (see the
sibling `switch-label-break-word` changeset) in six more components, found by auditing the rest of
the library for the same `overflow-wrap: anywhere` + `min-inline-size: 0` fingerprint on
natural-language text: `<lr-agent-eval-dashboard>` (heading and run-label text),
`<lr-realtime-session>` (status text), `<lr-spinner>` (the after-placement label),
`<lr-schema-viewer>` (name/description/issue text), `<lr-subagent-panel>` (label/task/model text),
and `<lr-callout>` (content/message text). Same root cause and fix in every case:
`overflow-wrap: break-word` gives the identical last-resort rescue for a genuinely unbreakable
long token without collapsing normal min-content sizing, so ordinary text now only wraps when it
truly cannot fit, and wraps at a word boundary when it does.
