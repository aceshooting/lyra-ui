---
'@aceshooting/lyra-ui': patch
---

`lr-subagent-panel` and `lr-json-schema-viewer` now reserve a position inside their 500-item render cap for the controlled selection (`selectedRunId`/`selectedPath`) and its resolvable ancestor chain, so a selection that would otherwise fall outside the rendered window still renders as selected instead of silently disappearing.
